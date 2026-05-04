import { NextResponse } from "next/server";
import { withGoogleToken } from "@/lib/google/auth";
import {
  fetchUpcomingEvents,
  fetchAttendeeEmailContext,
  type CalendarEvent,
} from "@/lib/google/calendar";
import { buildMeetingBrief } from "@/lib/agents/meeting-marv";
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
}

interface AgentResult {
  agent_id: string;
  events_fetched: number;
  events_skipped_already_briefed: number;
  briefs_generated: number;
  briefs_failed: number;
  inserted: number;
  insert_errors: number;
  error?: string;
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOOKAHEAD_MS = 24 * 60 * 60 * 1000; // 24h
const HOURS_SAVED_PER_BRIEF = 0.25; // 15 min of prep per meeting

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
    .eq("type", "meeting_prep")
    .eq("status", "active");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!agents?.length) return NextResponse.json({ processed: 0, agents: 0 });

  const results: AgentResult[] = [];
  for (const agent of agents as AgentRow[]) {
    try {
      results.push(await processAgent(agent));
    } catch (err) {
      const msg = (err as Error)?.message ?? "unknown";
      console.error("[meeting-prep] agent crashed", agent.id, err);
      try {
        await markAgentError(agent.id, `crash: ${msg}`);
      } catch {}
      results.push({
        agent_id: agent.id,
        events_fetched: 0,
        events_skipped_already_briefed: 0,
        briefs_generated: 0,
        briefs_failed: 0,
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
    .select("master_prompt")
    .eq("id", agent.user_id)
    .single();
  const masterPrompt = (profile as ProfileRow | null)?.master_prompt ?? null;

  const fetchResult = await withGoogleToken(agent.user_id, (token) =>
    fetchUpcomingEvents(token, LOOKAHEAD_MS, 25)
  );

  if (!fetchResult.ok) {
    const msg = `calendar_${fetchResult.reason}${
      fetchResult.error ? `: ${fetchResult.error}` : ""
    }`;
    await markAgentError(agent.id, msg);
    return {
      agent_id: agent.id,
      events_fetched: 0,
      events_skipped_already_briefed: 0,
      briefs_generated: 0,
      briefs_failed: 0,
      inserted: 0,
      insert_errors: 0,
      error: msg,
    };
  }
  const inner = fetchResult.data;
  if (!inner.ok) {
    await markAgentError(agent.id, inner.error);
    return {
      agent_id: agent.id,
      events_fetched: 0,
      events_skipped_already_briefed: 0,
      briefs_generated: 0,
      briefs_failed: 0,
      inserted: 0,
      insert_errors: 0,
      error: inner.error,
    };
  }
  const events = inner.events;

  // Pull existing briefs for this agent so we don't double-brief recurring events.
  const eventIds = events.map((e) => `cal:${e.id}`);
  let alreadyBriefed = new Set<string>();
  if (eventIds.length > 0) {
    const { data: existing } = await supabaseAdmin
      .from("agent_actions")
      .select("content")
      .eq("agent_id", agent.id)
      .in("status", ["pending_review", "approved"]);
    alreadyBriefed = new Set(
      (existing ?? [])
        .map((row) => (row as { content: { event_key?: string } }).content?.event_key)
        .filter((v): v is string => typeof v === "string")
    );
  }

  let generated = 0;
  let failed = 0;
  let inserted = 0;
  let insertErrors = 0;
  let skipped = 0;

  for (const event of events) {
    const key = `cal:${event.id}`;
    if (alreadyBriefed.has(key)) {
      skipped++;
      continue;
    }

    // Cap per-run cost: max 8 briefs per cron pass. Anything more, next run.
    if (generated >= 8) break;

    const primary = event.attendees.find((a) => !a.self) ?? null;
    let context: Awaited<ReturnType<typeof fetchAttendeeEmailContext>> = [];
    if (primary?.email) {
      const ctxResult = await withGoogleToken(agent.user_id, (token) =>
        fetchAttendeeEmailContext(token, primary.email, 4)
      );
      if (ctxResult.ok) context = ctxResult.data;
    }

    const brief = await buildMeetingBrief(event, context, masterPrompt);
    if (!brief) {
      failed++;
      continue;
    }
    generated++;

    const summary = brief.oneLine;
    const insertRes = await supabaseAdmin.from("agent_actions").insert({
      agent_id: agent.id,
      user_id: agent.user_id,
      type: "meeting_brief",
      summary,
      content: {
        event_key: key,
        event_id: event.id,
        starts_at: event.startIso,
        meeting_title: event.summary,
        meeting_link: event.hangoutLink,
        location: event.location,
        attendees: event.attendees.map((a) => ({
          email: a.email,
          name: a.displayName,
          self: !!a.self,
        })),
        brief,
      },
    });
    if (insertRes.error) {
      // Unique constraint on (agent_id, gmail_message_id) doesn't apply here,
      // but a similar dedup on event_key would be ideal. For now, the
      // alreadyBriefed pre-check handles dedup within a single run.
      console.error("[meeting-prep] insert failed", insertRes.error);
      insertErrors++;
    } else {
      inserted++;
    }
  }

  const persistError = await persistRunResult(agent.id, {
    tasksDelta: inserted,
    hoursDelta: inserted * HOURS_SAVED_PER_BRIEF,
    lastRunAt: runStartedIso,
  });

  return {
    agent_id: agent.id,
    events_fetched: events.length,
    events_skipped_already_briefed: skipped,
    briefs_generated: generated,
    briefs_failed: failed,
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
    console.error("[meeting-prep] bump_agent_stats failed", error);
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
