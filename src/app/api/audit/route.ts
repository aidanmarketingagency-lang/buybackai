import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { withGoogleToken } from "@/lib/google/auth";
import {
  fetchInboxMetadata,
  fetchCalendarEvents,
  summarizeActivity,
  type ActivitySummary,
} from "@/lib/google/activity";

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const WINDOW_DAYS = 14;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Atomic start: profile-row lock + in-flight check + daily quota + insert
  // happen inside one transaction in `start_audit()`. Concurrent POSTs for
  // the same user serialize behind the FOR UPDATE lock, so two requests
  // can't both pass the checks and double-spend Gmail/Anthropic calls.
  // We invoke through the user-session client so auth.uid() resolves correctly.
  const { data: auditId, error: startError } = await supabase.rpc("start_audit");

  if (startError) {
    if (startError.code === "P0003") {
      // audit_in_progress — message format: "audit_in_progress: <uuid>"
      const inflightId = startError.message.split(": ")[1]?.trim() ?? null;
      return NextResponse.json(
        {
          error: "audit_in_progress",
          message: "An audit is already running for your account.",
          auditId: inflightId,
        },
        { status: 409 }
      );
    }
    if (startError.code === "P0004") {
      return NextResponse.json(
        {
          error: "rate_limit",
          message: "You've hit your daily audit limit. Try again tomorrow or upgrade your plan.",
        },
        { status: 429 }
      );
    }
    if (startError.code === "42501") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (startError.code === "P0001") {
      return NextResponse.json({ error: "Profile missing" }, { status: 404 });
    }
    console.error("start_audit failed:", startError);
    return NextResponse.json({ error: "Could not start audit" }, { status: 500 });
  }

  // Now read hourly_rate for cost math (plan was already gated server-side).
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("hourly_rate")
    .eq("id", user.id)
    .single();
  const hourlyRate = (profile as { hourly_rate?: number } | null)?.hourly_rate ?? 250;

  // Fetch real Gmail + Calendar metadata. Distinguish "Google not connected"
  // from "everything looks fine" so the UI can prompt re-auth.
  const fetchOutcome = await withGoogleToken(user.id, async (token) => {
    const [emails, events] = await Promise.all([
      fetchInboxMetadata(token, WINDOW_DAYS, 500),
      fetchCalendarEvents(token, WINDOW_DAYS),
    ]);
    return { emails, events };
  });

  if (!fetchOutcome.ok) {
    // Mark the audit row failed so the in-flight slot frees up and the user
    // can retry after fixing the Google connection.
    await supabaseAdmin.from("audits").update({ status: "failed" }).eq("id", auditId);
    return NextResponse.json(
      {
        error: "google_not_connected",
        reason: fetchOutcome.reason,
        message:
          "We couldn't reach your Gmail or Calendar. Sign out and back in so we can re-establish the connection.",
      },
      { status: 412 }
    );
  }

  const { emails, events } = fetchOutcome.data;
  const summary = summarizeActivity(emails, events, WINDOW_DAYS);

  try {
    const message = await getAnthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(summary, hourlyRate) }],
    });

    const content = message.content[0];
    if (content.type !== "text") throw new Error("Unexpected response");

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const parsed = JSON.parse(jsonMatch[0]);
    const timeThieves = (parsed.time_thieves || []).map(
      (t: { hours_per_week: number; id?: string }) => ({
        ...t,
        id: t.id || crypto.randomUUID(),
        dollar_cost_per_week: Math.round(t.hours_per_week * hourlyRate),
      })
    );

    const totalHours = timeThieves.reduce(
      (s: number, t: { hours_per_week: number }) => s + t.hours_per_week,
      0
    );
    const totalCost = totalHours * hourlyRate;

    await supabaseAdmin
      .from("audits")
      .update({
        status: "complete",
        time_thieves: timeThieves,
        total_hours_wasted: totalHours,
        total_dollar_cost: totalCost,
      })
      .eq("id", auditId);

    return NextResponse.json({
      timeThieves,
      totalHours,
      totalCost,
      auditId,
      sourceData: {
        emailsAnalyzed: summary.emailsTotal,
        meetingsAnalyzed: summary.meetingsTotal,
        windowDays: WINDOW_DAYS,
      },
    });
  } catch (err) {
    await supabaseAdmin.from("audits").update({ status: "failed" }).eq("id", auditId);
    console.error("Audit error:", err);
    return NextResponse.json({ error: "Audit failed" }, { status: 500 });
  }
}

const SYSTEM_PROMPT = `You are an AI productivity analyst. You will be given a summarized snapshot of a real person's Gmail inbox and Google Calendar over the last 14 days. Your job is to identify their top "Time Thieves" — recurring tasks that an AI agent could take over.

Ground every finding in the actual data provided. Never invent patterns that aren't supported by the numbers. If a category has insufficient data, return fewer Time Thieves rather than padding the list.

Each Time Thief must include:
- title: a specific, concrete description (not generic) — reference real patterns from the data when possible
- description: 2 sentences explaining what you observed and why it adds up to the hours/week claim
- category: exactly one of email, meetings, admin, content, research, follow_up
- hours_per_week: a realistic number (0.5–8.0) derived from the data
- transfer_score: 1–5, how cleanly an AI agent can take this over
- examples: 2–3 specific examples drawn from the actual data (sender names, meeting titles, etc.)
- recommended_agent: exactly one of "Inbox Ivy" (email), "Meeting Marv" (meeting prep), "Follow-up Fred" (loop closer), "Recap Rita" (weekly report), "Recon Rex" (research), "Repurpose Ren" (content)

Return ONLY valid JSON with this exact shape:
{
  "time_thieves": [
    {
      "title": "...",
      "description": "...",
      "category": "...",
      "hours_per_week": 3.5,
      "transfer_score": 4,
      "examples": ["...", "..."],
      "recommended_agent": "..."
    }
  ]
}`;

function buildUserPrompt(s: ActivitySummary, rate: number): string {
  const topSendersStr = s.emailsFromTopSenders
    .slice(0, 10)
    .map((x) => `  - ${x.sender}: ${x.count} emails`)
    .join("\n");
  const topRecurringStr = s.topRecurringMeetings
    .slice(0, 6)
    .map(
      (x) =>
        `  - "${x.title}" — ~${x.weeklyCount}x/week, ${x.weeklyHours}h/week`
    )
    .join("\n");

  return `User's last ${s.windowDays} days of activity (real data, not synthetic):

EMAIL
- Total inbox messages received: ${s.emailsTotal}
- Top senders by volume:
${topSendersStr || "  (no inbox activity in window)"}

CALENDAR
- Total meetings: ${s.meetingsTotal}
- Total time in meetings: ${s.meetingHoursTotal}h
- Average meeting length: ${s.averageMeetingDurationMin} minutes
- Recurring meetings: ${s.recurringMeetingsCount}
- Back-to-back meetings: ${s.meetingsBack2Back}
- Top recurring meetings:
${topRecurringStr || "  (no recurring meetings detected)"}

USER CONTEXT
- Hourly rate: $${rate}

Now identify their top Time Thieves. Aim for 4–6 of them. Be specific — reference actual senders or meeting titles in the examples when patterns are obvious. If the data is sparse (e.g. fewer than 20 emails), return fewer findings rather than padding.`;
}
