import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./dashboard-client";

// master_prompt is intentionally excluded — it can hold sensitive operational
// context (priorities, key contacts, communication rules). The dashboard
// doesn't render it; the onboarding/settings page fetches it on demand.
const PROFILE_PUBLIC_FIELDS =
  "id, email, full_name, avatar_url, hourly_rate, plan, onboarding_complete, created_at, updated_at";

const AGENT_PUBLIC_FIELDS =
  "id, user_id, type, name, description, status, tasks_completed, hours_saved, last_run_at, created_at";

const AUDIT_PUBLIC_FIELDS =
  "id, user_id, status, total_hours_wasted, total_dollar_cost, created_at";

const ACTION_PUBLIC_FIELDS =
  "id, agent_id, user_id, type, summary, content, status, created_at";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_PUBLIC_FIELDS)
    .eq("id", user.id)
    .single();

  const { data: agents } = await supabase
    .from("agents")
    .select(AGENT_PUBLIC_FIELDS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Surface both pending_review AND processing items. A row sitting in
  // 'processing' is either mid-approval or stuck after a finalize failure
  // (with orphan_draft_id recorded in content). Either way the user needs
  // to see it — silently hiding processing rows would let orphan Gmail
  // drafts go unnoticed.
  const { data: actions } = await supabase
    .from("agent_actions")
    .select(ACTION_PUBLIC_FIELDS)
    .eq("user_id", user.id)
    .in("status", ["pending_review", "processing"])
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: latestAudit } = await supabase
    .from("audits")
    .select(AUDIT_PUBLIC_FIELDS)
    .eq("user_id", user.id)
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return (
    <DashboardClient
      profile={profile}
      agents={agents || []}
      actions={actions || []}
      latestAudit={latestAudit}
    />
  );
}
