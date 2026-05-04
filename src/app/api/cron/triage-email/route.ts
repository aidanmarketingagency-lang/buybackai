import { NextResponse } from "next/server";
import { withGoogleToken } from "@/lib/google/auth";
import { fetchRecentInboxMessages, type ParsedEmail } from "@/lib/google/gmail";
import { triageEmail } from "@/lib/agents/inbox-ivy";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface AgentRow {
  id: string;
  user_id: string;
  type: string;
  status: string;
  hours_saved: number;
  tasks_completed: number;
  last_run_at: string | null;
  oldest_unhandled_at: string | null;
}

interface ProfileRow {
  master_prompt: string | null;
}

interface AgentResult {
  agent_id: string;
  emails_fetched: number;
  pre_dedup_skipped: number;
  triage_succeeded: number;
  triage_failed: number;
  inserted: number;
  skipped_low_priority: number;
  insert_errors: number;
  truncated: boolean;
  next_checkpoint: string;
  /** Cursor for next run's `before:` filter — null means full window drained. */
  next_cursor: string | null;
  /** Set when checkpoint/stat persistence fails. */
  persistence_error?: string;
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Auth: only `Authorization: Bearer <CRON_SECRET>` header is accepted.
  // Vercel Cron sends this automatically. Query-string secrets are rejected
  // (URL params leak via access logs, browser history, monitoring, etc.).
  // Local dev bypasses auth entirely so we can hit it from the browser.
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const ok =
    process.env.NODE_ENV === "development" ||
    (expected && authHeader === `Bearer ${expected}`);

  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: agents, error } = await supabaseAdmin
    .from("agents")
    .select(
      "id, user_id, type, status, hours_saved, tasks_completed, last_run_at, oldest_unhandled_at"
    )
    .eq("type", "email_triage")
    .eq("status", "active");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!agents?.length) return NextResponse.json({ processed: 0, agents: 0 });

  const results: AgentResult[] = [];
  for (const agent of agents as AgentRow[]) {
    try {
      results.push(await processAgent(agent));
    } catch (err) {
      const msg = (err as Error)?.message ?? "unknown";
      console.error("Agent processing crashed for", agent.id, err);
      // Best-effort: surface the crash so the agent doesn't sit in active
      // status pretending to work. Swallow secondary failures here so one
      // bad agent can't break the whole cron loop.
      try {
        await markAgentError(agent.id, `crash: ${msg}`);
      } catch {}
      results.push({
        agent_id: agent.id,
        emails_fetched: 0,
        pre_dedup_skipped: 0,
        triage_succeeded: 0,
        triage_failed: 0,
        inserted: 0,
        skipped_low_priority: 0,
        insert_errors: 0,
        truncated: false,
        next_checkpoint: agent.last_run_at ?? new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        next_cursor: agent.oldest_unhandled_at,
        persistence_error: msg,
      });
    }
  }

  return NextResponse.json({ agents: agents.length, results });
}

async function processAgent(agent: AgentRow): Promise<AgentResult> {
  // High-water mark captured BEFORE the Gmail fetch. Anything that arrives in
  // the user's inbox after this instant has a timestamp >= runStartedMs and
  // is intentionally OUT of this run's window — the next run picks it up via
  // its own `after:runStartedMs` query. Without this, mail that arrives
  // between the Gmail list call and the checkpoint write would silently fall
  // before the new checkpoint and never be processed.
  const runStartedMs = Date.now();
  const runStartedIso = new Date(runStartedMs).toISOString();

  const lookbackMs = agent.last_run_at
    ? new Date(agent.last_run_at).getTime()
    : runStartedMs - 60 * 60 * 1000;

  // Cursor (ceiling): when set, last run was truncated and we're draining
  // backwards. The fetch ceiling is min(cursorMs, runStartedMs).
  const cursorMs = agent.oldest_unhandled_at
    ? new Date(agent.oldest_unhandled_at).getTime()
    : undefined;
  const ceilingMs =
    cursorMs !== undefined ? Math.min(cursorMs, runStartedMs) : runStartedMs;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("master_prompt")
    .eq("id", agent.user_id)
    .single();
  const masterPrompt = (profile as ProfileRow | null)?.master_prompt ?? null;

  const fetchResult = await withGoogleToken(agent.user_id, async (token) =>
    fetchRecentInboxMessages(token, lookbackMs, 25, ceilingMs)
  );

  // Token/Gmail dependency failure — DO NOT advance the checkpoint, but DO
  // persist the failure on the agent so the dashboard / monitoring can see
  // that the agent is stalled rather than quietly producing no actions.
  if (!fetchResult.ok) {
    const errorMsg = `gmail_${fetchResult.reason}${
      fetchResult.error ? `: ${fetchResult.error}` : ""
    }`;
    console.warn(`[cron] agent ${agent.id} could not reach Gmail: ${errorMsg}`);
    await markAgentError(agent.id, errorMsg);
    return {
      agent_id: agent.id,
      emails_fetched: 0,
      pre_dedup_skipped: 0,
      triage_succeeded: 0,
      triage_failed: 0,
      inserted: 0,
      skipped_low_priority: 0,
      insert_errors: 0,
      truncated: false,
      next_checkpoint: agent.last_run_at ?? new Date(lookbackMs).toISOString(),
      next_cursor: agent.oldest_unhandled_at,
      persistence_error: errorMsg,
    };
  }

  const { emails, truncated } = fetchResult.data;

  if (emails.length === 0) {
    // Empty page within the [lookbackMs, runStartedMs] window. Use the
    // pre-fetch high-water mark, NOT new Date(), so we don't accidentally
    // skip mail that arrived during processing.
    const persistError = await persistRunResult(agent.id, {
      tasksDelta: 0,
      hoursDelta: 0,
      lastRunAt: runStartedIso,
      oldestUnhandledAt: null, // drained
    });
    return {
      agent_id: agent.id,
      emails_fetched: 0,
      pre_dedup_skipped: 0,
      triage_succeeded: 0,
      triage_failed: 0,
      inserted: 0,
      skipped_low_priority: 0,
      insert_errors: 0,
      truncated: false,
      next_checkpoint: runStartedIso,
      next_cursor: null,
      ...(persistError ? { persistence_error: persistError } : {}),
    };
  }

  // PRE-CHECK DEDUP: pull the gmail_ids we already have actions for so we
  // don't waste Claude calls on messages we've already triaged. Critical
  // when the backlog cursor is forcing us back over recently-processed
  // territory.
  const { data: existingRows } = await supabaseAdmin
    .from("agent_actions")
    .select("gmail_message_id")
    .eq("agent_id", agent.id)
    .in("gmail_message_id", emails.map((e) => e.id));
  const seenIds = new Set(
    (existingRows || [])
      .map((r) => (r as { gmail_message_id: string | null }).gmail_message_id)
      .filter((x): x is string => !!x)
  );

  const newEmails = emails.filter((e) => !seenIds.has(e.id));
  const preDedupSkipped = emails.length - newEmails.length;

  // Sort fetched emails (NOT just newEmails) by date so cursor logic uses
  // the actual oldest fetched message, even if it was a dup.
  emails.sort((a, b) => a.date.getTime() - b.date.getTime());
  newEmails.sort((a, b) => a.date.getTime() - b.date.getTime());

  const result: AgentResult = {
    agent_id: agent.id,
    emails_fetched: emails.length,
    pre_dedup_skipped: preDedupSkipped,
    triage_succeeded: 0,
    triage_failed: 0,
    inserted: 0,
    skipped_low_priority: 0,
    insert_errors: 0,
    truncated,
    next_checkpoint: agent.last_run_at ?? new Date(lookbackMs).toISOString(),
    next_cursor: agent.oldest_unhandled_at,
  };

  let earliestFailureMs: number | null = null;

  for (const email of newEmails) {
    const outcome = await processOneEmail(agent, email, masterPrompt);
    const ms = email.date.getTime();
    switch (outcome.status) {
      case "inserted":
        result.triage_succeeded += 1;
        result.inserted += 1;
        break;
      case "duplicate":
        result.triage_succeeded += 1;
        break;
      case "skipped":
        result.triage_succeeded += 1;
        result.skipped_low_priority += 1;
        break;
      case "triage_failed":
        result.triage_failed += 1;
        if (earliestFailureMs === null || ms < earliestFailureMs) earliestFailureMs = ms;
        break;
      case "insert_failed":
        result.insert_errors += 1;
        if (earliestFailureMs === null || ms < earliestFailureMs) earliestFailureMs = ms;
        break;
    }
  }

  // Compute the next checkpoint + cursor:
  //   - failures: leave time checkpoint at agent.last_run_at, do not advance
  //     cursor either. Next run retries the same window.
  //   - truncated: time checkpoint unchanged, cursor = oldest fetched email's
  //     date so next run pulls strictly older messages.
  //   - clean (no failures, no truncation): time checkpoint = runStartedIso
  //     (the high-water mark captured BEFORE we hit Gmail). Using runStartedIso
  //     instead of new Date() prevents skipping mail that arrived during
  //     processing — those messages have timestamps >= runStartedMs and the
  //     fetch ceiling already excluded them, so the next run picks them up.
  let newCheckpoint: string;
  let newCursor: string | null = agent.oldest_unhandled_at;

  if (earliestFailureMs !== null) {
    newCheckpoint = agent.last_run_at ?? new Date(lookbackMs).toISOString();
    // cursor unchanged
  } else if (truncated) {
    newCheckpoint = agent.last_run_at ?? new Date(lookbackMs).toISOString();
    const oldestFetched = emails[0].date.getTime();
    newCursor = new Date(oldestFetched).toISOString();
  } else {
    newCheckpoint = runStartedIso;
    newCursor = null;
  }
  result.next_checkpoint = newCheckpoint;
  result.next_cursor = newCursor;

  const actualHoursSaved = (result.inserted * 3) / 60;
  const persistError = await persistRunResult(agent.id, {
    tasksDelta: result.inserted,
    hoursDelta: actualHoursSaved,
    lastRunAt: newCheckpoint,
    oldestUnhandledAt: newCursor,
  });
  if (persistError) result.persistence_error = persistError;

  return result;
}

/**
 * Persist counter increments + checkpoint + cursor in two writes (the
 * atomic-counter RPC for stats, then the cursor field). Returns an error
 * string if either write fails, so the cron can flag the agent rather than
 * silently report success.
 */
async function persistRunResult(
  agentId: string,
  args: {
    tasksDelta: number;
    hoursDelta: number;
    lastRunAt: string;
    oldestUnhandledAt: string | null;
  }
): Promise<string | null> {
  // Single atomic write: counter increment + checkpoint advance + cursor +
  // error-clear all happen in one statement inside persist_agent_run. The
  // previous two-step approach could leave an advanced checkpoint with a
  // stale cursor on partial failure, producing a malformed window the next
  // run might silently skip.
  const { error } = await supabaseAdmin.rpc("persist_agent_run", {
    p_agent_id: agentId,
    p_tasks_delta: args.tasksDelta,
    p_hours_delta: args.hoursDelta,
    p_last_run_at: args.lastRunAt,
    p_oldest_unhandled_at: args.oldestUnhandledAt,
    p_clear_error: true,
  });

  if (error) {
    console.error(`[cron] persist_agent_run failed for ${agentId}:`, error);
    await markAgentError(agentId, `persist_agent_run: ${error.message}`);
    return error.message;
  }

  return null;
}

async function markAgentError(agentId: string, message: string): Promise<void> {
  await supabaseAdmin
    .from("agents")
    .update({
      last_error: message.slice(0, 500),
      last_error_at: new Date().toISOString(),
    })
    .eq("id", agentId);
}

type EmailOutcome =
  | { status: "inserted" }
  | { status: "duplicate" }
  | { status: "skipped" }
  | { status: "triage_failed" }
  | { status: "insert_failed" };

async function processOneEmail(
  agent: AgentRow,
  email: ParsedEmail,
  masterPrompt: string | null
): Promise<EmailOutcome> {
  const triage = await triageEmail(email, masterPrompt);
  if (!triage) return { status: "triage_failed" };

  const surface =
    triage.category === "urgent" ||
    triage.category === "needs_reply" ||
    triage.category === "fyi";

  if (!surface) return { status: "skipped" };

  // Map triage category → action type. FYI gets its own type so the
  // approval handler doesn't try to create a Gmail draft for it.
  const actionType =
    triage.category === "urgent"
      ? "urgent_email"
      : triage.category === "fyi"
      ? "email_fyi"
      : "email_reply";

  const { error } = await supabaseAdmin.from("agent_actions").insert({
    agent_id: agent.id,
    user_id: agent.user_id,
    type: actionType,
    summary: triage.oneLine,
    content: {
      gmail_id: email.id,
      gmail_thread_id: email.threadId,
      from: email.from,
      subject: email.subject,
      snippet: email.snippet,
      category: triage.category,
      priority: triage.priority,
      draft: triage.draftReply,
      reasoning: triage.reasoning,
    },
    status: "pending_review",
  });

  if (error) {
    // Postgres unique-violation = we already inserted this email in a prior run.
    // That's fine — treat as durably handled.
    if (error.code === "23505") return { status: "duplicate" };

    console.error("agent_actions insert failed:", error);
    return { status: "insert_failed" };
  }

  return { status: "inserted" };
}
