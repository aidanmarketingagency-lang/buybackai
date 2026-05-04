import { supabaseAdmin } from "@/lib/supabase/admin";

interface RefreshResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export type WithTokenResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "no_token" | "no_refresh_token" | "refresh_failed" | "fetch_failed"; error?: string };

/**
 * Get a stored Google access token. Reads from `user_secrets` (server-only
 * table) — never from the client-readable profile.
 */
export async function getGoogleAccessToken(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("user_secrets")
    .select("google_access_token")
    .eq("user_id", userId)
    .maybeSingle();

  const token = (data as { google_access_token?: string | null } | null)?.google_access_token;
  return token ?? null;
}

/**
 * Exchange the refresh token for a fresh access token, persist it, return it.
 * Returns null if no refresh token is stored or Google rejects the exchange.
 */
export async function refreshGoogleAccessToken(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("user_secrets")
    .select("google_refresh_token")
    .eq("user_id", userId)
    .maybeSingle();

  const refreshToken = (data as { google_refresh_token?: string | null } | null)?.google_refresh_token;
  if (!refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    console.error("Token refresh failed:", await res.text());
    return null;
  }

  const tokens: RefreshResponse = await res.json();

  await supabaseAdmin
    .from("user_secrets")
    .update({
      google_access_token: tokens.access_token,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return tokens.access_token;
}

/**
 * Run `fn` with a valid Google access token. Returns a discriminated result:
 *   { ok: true, data }   — Gmail call succeeded
 *   { ok: false, reason } — token missing, refresh failed, or upstream errored
 *
 * The cron MUST distinguish these from a real empty inbox so it doesn't
 * advance its checkpoint past unread mail when Google access is broken.
 */
export async function withGoogleToken<T>(
  userId: string,
  fn: (token: string) => Promise<T>
): Promise<WithTokenResult<T>> {
  let token = await getGoogleAccessToken(userId);
  if (!token) {
    // No access token at all — but maybe we have a refresh token to bootstrap.
    token = await refreshGoogleAccessToken(userId);
    if (!token) return { ok: false, reason: "no_token" };
  }

  try {
    const data = await fn(token);
    return { ok: true, data };
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    const isUnauthorized =
      e?.status === 401 || (e?.message && e.message.includes("401"));

    if (!isUnauthorized) {
      return { ok: false, reason: "fetch_failed", error: e?.message };
    }

    // Try one refresh + retry.
    const refreshed = await refreshGoogleAccessToken(userId);
    if (!refreshed) return { ok: false, reason: "refresh_failed" };

    try {
      const data = await fn(refreshed);
      return { ok: true, data };
    } catch (retryErr: unknown) {
      const re = retryErr as { message?: string };
      return { ok: false, reason: "fetch_failed", error: re?.message };
    }
  }
}
