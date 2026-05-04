import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Allowlist of safe internal redirect targets. Anything else falls back to
// /dashboard. This prevents post-OAuth open-redirect attacks where a crafted
// `next=//evil.com/...` value could turn the callback into a phishing relay.
const SAFE_NEXT_PATHS = new Set([
  "/dashboard",
  "/onboarding",
  "/audit",
  "/agents",
]);

function safeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.startsWith("/\\") ||
    raw.includes("://") ||
    raw.includes("\\")
  ) {
    return "/dashboard";
  }
  const pathOnly = raw.split("?")[0].split("#")[0];
  return SAFE_NEXT_PATHS.has(pathOnly) ? raw : "/dashboard";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // We deliberately ignore any `plan=` query param. Plan can ONLY be
  // upgraded by a trusted billing webhook (Stripe checkout.session.completed
  // → updates profiles.plan via service role). Honoring a client-supplied
  // plan here would let anyone bypass billing by hitting /auth/callback?plan=founder.
  const next = safeNext(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=no_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  const userId = data.user.id;
  const providerToken = data.session?.provider_token ?? null;
  const providerRefreshToken = data.session?.provider_refresh_token ?? null;

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from("profiles")
      .update({
        email: data.user.email!,
        full_name: data.user.user_metadata?.full_name || null,
        avatar_url: data.user.user_metadata?.avatar_url || null,
      })
      .eq("id", userId);
  } else {
    await supabaseAdmin.from("profiles").insert({
      id: userId,
      email: data.user.email!,
      full_name: data.user.user_metadata?.full_name || null,
      avatar_url: data.user.user_metadata?.avatar_url || null,
      hourly_rate: 250,
      plan: "free",
      onboarding_complete: false,
    });
  }

  if (providerToken || providerRefreshToken) {
    await supabaseAdmin.from("user_secrets").upsert(
      {
        user_id: userId,
        ...(providerToken && { google_access_token: providerToken }),
        ...(providerRefreshToken && { google_refresh_token: providerRefreshToken }),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
