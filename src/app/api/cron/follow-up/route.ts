import { NextResponse } from "next/server";
import { withGoogleToken } from "@/lib/google/auth";
import { fetchQuietThreads } from "@/lib/google/sent-threads";
import { buildFollowUpDraft } from "@/lib/agents/follow-up-fred";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface AgentRow {
  id: string;
  user_id: string;
  type: string;
  status: string;
  hours_saved: number;
  tasks_completed: number;
  last_run_at: string | null;
}

interface ProfileRow {
  master_prompt: string | null;
  email: string;
}

interface AgentResult {
  agent_id: string;
  threads_scanned: number;
  threads_skipped_already_drafted: number;
  drafts_generated: number;
  drafts_failed: number;
  inserted: number;
  insert_errors: number;
  error?: string;
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const QUIET_DAYS = 4;
const WINDOW_DAYS = 21;
const MAX_PER_RUN = 8;
const HOURS_SAVED_PER_DRAFT = 0.1; // 6 min of finding+writing per nudge

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const ok =
    process.env.NODE_ENV === "development" ||
    (expected && authHeader === `Bearer ${expected}`);
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: agents, error } = await supabaseAdmin
    .from("agents")
    .select("id, user_id, type, status, hours_saved, tasks_completed, last_run_at")
    .eq("type", "follow_up")
    .eq("status", "active");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!agents?.length) return NextResponse.json({ processed: 0, agents: 0 });

  const results: AgentResult[] = [];
  for (const agent of agents as AgentRow[]) {
    try {
      results.push(await processAgent(agent));
    } catch (err) {
      const msg = (err as Error)?.message ?? "unknown";
      console.error("[follow-up] agent crashed", agent.id, err);
      try {
        await markAgentError(agent.id, `crash: ${msg}`);
      } catch {}
      results.push({
        agent_id: agent.id,
        threads_scanned: 0,
        threads_skipped_already_drafted: 0,
        drafts_generated: 0,
        drafts_failed: 0,
        inserted: 0,
        insert_errors: 0,
        error: msg,
      });
    }
  }

  return NextResponse.json({
    processed: results.reduce((n, r) => n + r.inserted, 0),
    agents: agents.length,
    results,
  });
}

async function processAgent(agent: AgentRow): Promise<AgentResult> {
  const runStartedIso = new Date().toISOString();

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("master_prompt, email")
    .eq("id", agent.user_id)
    .single();
  const profileTyped = profile as ProfileRow | null;
  const masterPrompt = profileTyped?.master_prompt ?? null;
  const userEmail = profileTyped?.email ?? "";

  if (!userEmail) {
    await markAgentError(agent.id, "no_user_email");
    return {
      agent_id: agent.id,
      threads_scanned: 0,
      threads_skipped_already_drafted: 0,
      drafts_generated: 0,
      drafts_failed: 0,
      inserted: 0,
      insert_errors: 0,
      error: "no_user_email",
    };
  }

  const fetchResult = await withGoogleToken(agent.user_id, (token) =>
    fetchQuietThreads(token, userEmail, QUIET_DAYS, WINDOW_DAYS, MAX_PER_RUN * 2)
  );

  if (!fetchResult.ok) {
    const msg = `gmail_${fetchResult.reason}${fetchResult.error ? `: ${fetchResult.error}` : ""}`;
    await markAgentError(agent.id, msg);
    return {
      agent_id: agent.id,
      threads_scanned: 0,
      threads_skipped_already_drafted: 0,
      drafts_generated: 0,
      drafts_failed: 0,
      inserted: 0,
      insert_errors: 0,
      error: msg,
    };
  }
  if (!fetchResult.data.ok) {
    await markAgentError(agent.id, fetchResult.data.error);
    return {
      agent_id: agent.id,
      threads_scanned: 0,
      threads_skipped_already_drafted: 0,
      drafts_generated: 0,
      drafts_failed: 0,
      inserted: 0,
      insert_errors: 0,
      error: fetchResult.data.error,
    };
  }

  const threads = fetchResult.data.threads;

  const { data: existing } = await supabaseAdmin
    .from("agent_actions")
    .select("content")
    .eq("agent_id", agent.id)
    .in("status", ["pending_review", "approved"]);
  const alreadyDrafted = new Set(
    (existing ?? [])
      .map(
        (row) =>
          (row as { content: { thread_key?: string } }).content?.thread_key
      )
      .filter((v): v is string => typeof v === "string")
  );

  let generated = 0;
  let failed = 0;
  let inserted = 0;
  let insertErrors = 0;
  let skipped = 0;

  for (const thread of threads) {
    if (generated >= MAX_PER_RUN) break;
    const key = `thread:${thread.threadId}:${thread.lastMessageId}`;
    if (alreadyDrafted.has(key)) {
      skipped++;
      continue;
    }
    const daysSince = Math.floor(
      (Date.now() - thread.lastMessageMs) / (24 * 60 * 60 * 1000)
    );
    const draft = await buildFollowUpDraft(thread, daysSince, masterPrompt);
    if (!draft) {
      failed++;
      continue;
    }
    generated++;

    const insertRes = await supabaseAdmin.from("agent_actions").insert({
      agent_id: agent.id,
      user_id: agent.user_id,
      type: "follow_up_draft",
      summary: draft.oneLine,
      content: {
        thread_key: key,
        gmail_id: thread.lastMessageId,
        thread_id: thread.threadId,
        recipient: thread.recipient,
        recipient_name: thread.recipientName,
        subject: thread.subject,
        days_since: daysSince,
        last_excerpt: thread.lastBodyExcerpt,
        draft_reply: draft.draftReply,
        tone_note: draft.toneNote,
      },
    });
    if (insertRes.error) {
      console.error("[follow-up] insert failed", insertRes.error);
      insertErrors++;
    } else {
      inserted++;
    }
  }

  const persistError = await persistRunResult(agent.id, {
    tasksDelta: inserted,
    hoursDelta: inserted * HOURS_SAVED_PER_DRAFT,
    lastRunAt: runStartedIso,
  });

  return {
    agent_id: agent.id,
    threads_scanned: threads.length,
    threads_skipped_already_drafted: skipped,
    drafts_generated: generated,
    drafts_failed: failed,
    inserted,
    insert_errors: insertErrors,
    error: persistError ?? undefined,
  };
}

async function persistRunResult(
  agentId: string,
  args: { tasksDelta: number; hoursDelta: number; lastRunAt: string }
): Promise<string | null> {
  const { error } = await supabaseAdmin.rpc("bump_agent_stats", {
    p_agent_id: agentId,
    p_tasks_delta: args.tasksDelta,
    p_hours_delta: args.hoursDelta,
    p_last_run_at: args.lastRunAt,
  });
  if (error) {
    console.error("[follow-up] bump_agent_stats failed", error);
    return error.message;
  }
  return null;
}

async function markAgentError(agentId: string, message: string) {
  await supabaseAdmin
    .from("agents")
    .update({
      last_error: message.slice(0, 500),
      last_error_at: new Date().toISOString(),
    })
    .eq("id", agentId);
}
