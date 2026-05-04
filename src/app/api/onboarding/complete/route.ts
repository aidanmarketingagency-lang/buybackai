import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { masterPrompt } = await request.json();

  await supabase
    .from("profiles")
    .update({ master_prompt: masterPrompt, onboarding_complete: true })
    .eq("id", user.id);

  return NextResponse.json({ success: true });
}
