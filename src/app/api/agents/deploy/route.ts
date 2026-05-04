import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const AGENT_NAMES: Record<string, string> = {
  email_triage: "Inbox Ivy",
  meeting_prep: "Meeting Marv",
  follow_up: "Follow-up Fred",
  weekly_report: "Recap Rita",
  research: "Recon Rex",
  content_repurpose: "Repurpose Ren",
};

export async function POST(request: Request) {
  // Identity check via user session client.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type } = await request.json();
  if (!AGENT_NAMES[type]) {
    return NextResponse.json({ error: "Invalid agent type" }, { status: 400 });
  }

  // Atomic deploy via Postgres RPC. The function takes a row-level lock on
  // the caller's profile, checks the active-agent count, and inserts the new
  // agent in a single transaction. Concurrent POSTs for the same user
  // serialize behind the lock, so plan limits cannot be exceeded by racing.
  //
  // We invoke through the user-session client so `auth.uid()` inside the
  // function resolves to the actual signed-in user.
  const { data, error } = await supabase.rpc("deploy_agent", {
    p_type: type,
    p_name: AGENT_NAMES[type],
  });

  if (error) {
    // Postgres custom errcodes from the function:
    //   42501 → unauthorized
    //   P0001 → profile missing
    //   P0002 → plan limit reached
    //   P0005 → duplicate active agent of this type already exists
    if (error.code === "P0005") {
      const existingId = error.message.split(": ")[1]?.trim() ?? null;
      return NextResponse.json(
        {
          error: "duplicate_agent",
          message: "You already have this agent active. Pause it first if you want to redeploy.",
          existingAgentId: existingId,
        },
        { status: 409 }
      );
    }
    if (error.code === "P0002") {
      return NextResponse.json(
        { error: "Plan limit reached", upgrade: true },
        { status: 403 }
      );
    }
    if (error.code === "42501") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.code === "P0001") {
      return NextResponse.json({ error: "Profile missing" }, { status: 404 });
    }
    if (error.code === "P0006") {
      return NextResponse.json(
        { error: "unknown_agent_type", message: "That agent type doesn't exist." },
        { status: 400 }
      );
    }
    console.error("deploy_agent failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ agent: data });
  // Service-role admin client kept available for any future server-only
  // post-deploy work (e.g., triggering an immediate first run).
  void supabaseAdmin;
}
