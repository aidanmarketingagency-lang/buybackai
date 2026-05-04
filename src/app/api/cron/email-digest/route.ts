import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, resendConfigured } from "@/lib/email/resend";
import { dailyDigestTemplate, type DigestActionItem } from "@/lib/email/templates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  email_unsubscribed_at: string | null;
  last_digest_sent_at: string | null;
}

interface ActionRow {
  agent_id: string;
  summary: string;
  agents: { name: string } | { name: string }[] | null;
}

// Cron: 09:30 UTC daily. Sends a digest to any user with at least one
// pending_review action that hasn't been digested in the last 18 hours.
// Idempotent: re-runs within the window are no-ops because of the
// last_digest_sent_at gate below.

const MIN_HOURS_BETWEEN_DIGESTS = 18;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const ok =
    process.env.NODE_ENV === "development" ||
    (expected && authHeader === `Bearer ${expected}`);
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!resendConfigured) {
    return NextResponse.json({
      skipped: true,
      reason: "resend_not_configured",
    });
  }

  // Pull users who have unread pending actions. We do this via a
  // distinct query on agent_actions and join up to profiles to get
  // the email + flags. Cap at 100 users per run; if you have more
  // active users than that, scale this to a paginated job.
  const { data: actionRows, error: aErr } = await supabaseAdmin
    .from("agent_actions")
    .select("user_id")
    .eq("status", "pending_review")
    .limit(500);
  if (aErr) {
    return NextResponse.json({ error: aErr.message }, { status: 500 });
  }
  const userIds = Array.from(new Set((actionRows ?? []).map((r) => r.user_id)));
  if (userIds.length === 0) {
    return NextResponse.json({ digested: 0, skipped: 0, errors: 0 });
  }

  const { data: profiles, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, email_unsubscribed_at, last_digest_sent_at")
    .in("id", userIds);
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const cutoffMs = Date.now() - MIN_HOURS_BETWEEN_DIGESTS * 60 * 60 * 1000;

  let digested = 0;
  let skipped = 0;
  let errors = 0;
  const results: Array<{ user_id: string; status: string }> = [];

  for (const profile of (profiles ?? []) as ProfileRow[]) {
    if (profile.email_unsubscribed_at) {
      skipped++;
      results.push({ user_id: profile.id, status: "unsubscribed" });
      continue;
    }
    if (
      profile.last_digest_sent_at &&
      Date.parse(profile.last_digest_sent_at) > cutoffMs
    ) {
      skipped++;
      results.push({ user_id: profile.id, status: "recent_digest" });
      continue;
    }
    if (!profile.email) {
      skipped++;
      results.push({ user_id: profile.id, status: "no_email" });
      continue;
    }

    // Pull this user's pending actions with agent name.
    const { data: rows } = await supabaseAdmin
      .from("agent_actions")
      .select("agent_id, summary, agents:agents!inner(name)")
      .eq("user_id", profile.id)
      .eq("status", "pending_review")
      .order("created_at", { ascending: false })
      .limit(8);

    const items: DigestActionItem[] = (rows ?? []).map((row) => {
      const r = row as ActionRow;
      const ag = Array.isArray(r.agents) ? r.agents[0] : r.agents;
      return {
        agentName: ag?.name ?? "Agent",
        summary: r.summary,
      };
    });

    if (items.length === 0) {
      skipped++;
      results.push({ user_id: profile.id, status: "no_items" });
      continue;
    }

    const tpl = dailyDigestTemplate({
      userId: profile.id,
      firstName: profile.full_name?.split(" ")[0] ?? null,
      pendingCount: items.length,
      items,
    });

    const sendResult = await sendEmail({
      to: profile.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      tag: "daily_digest",
    });

    if (!sendResult.ok) {
      errors++;
      results.push({ user_id: profile.id, status: `error:${sendResult.error}` });
      continue;
    }

    await supabaseAdmin
      .from("profiles")
      .update({ last_digest_sent_at: new Date().toISOString() })
      .eq("id", profile.id);

    digested++;
    results.push({ user_id: profile.id, status: "sent" });
  }

  return NextResponse.json({ digested, skipped, errors, results });
}
