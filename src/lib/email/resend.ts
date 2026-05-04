import { Resend } from "resend";
import crypto from "crypto";

const apiKey = process.env.RESEND_API_KEY;
export const resend = apiKey ? new Resend(apiKey) : null;
export const resendConfigured = Boolean(apiKey);

// FROM address. When the user verifies their domain in Resend, set
// RESEND_FROM_EMAIL=notify@yourdomain.com in Vercel. Otherwise we fall
// back to Resend's default test sender which works without verification
// but appends "via resend.dev" in clients.
export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "BuybackAI <onboarding@resend.dev>";

// Reply-to lets users reply directly to the founder. If unset, replies
// go to the FROM address (usually a no-reply).
export const REPLY_TO = process.env.RESEND_REPLY_TO ?? "aidanmarketingagency@gmail.com";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://buybackai.vercel.app";

/**
 * HMAC-SHA256 signed unsubscribe token. Lets users opt out via a single
 * link without exposing the user_id (which would let anyone unsubscribe
 * anyone else). Verifier is in /unsubscribe route.
 */
const UNSUB_SECRET =
  process.env.EMAIL_UNSUB_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function signUnsubToken(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = crypto
    .createHmac("sha256", UNSUB_SECRET)
    .update(payload)
    .digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyUnsubToken(token: string): string | null {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return null;
    const payload = Buffer.from(payloadB64, "base64url").toString("utf8");
    const expected = crypto
      .createHmac("sha256", UNSUB_SECRET)
      .update(payload)
      .digest("base64url");
    // timing-safe compare
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const [userId] = payload.split(".");
    if (!userId) return null;
    return userId;
  } catch {
    return null;
  }
}

export function unsubLink(userId: string): string {
  const token = signUnsubToken(userId);
  return `${APP_URL}/unsubscribe?t=${encodeURIComponent(token)}`;
}

export function appLink(path: string): string {
  return `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
  tag?: string;
}

export async function sendEmail(args: SendArgs): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  if (!resend || !resendConfigured) {
    return { ok: false, error: "resend_not_configured" };
  }
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: args.to,
      replyTo: REPLY_TO,
      subject: args.subject,
      html: args.html,
      text: args.text,
      tags: args.tag ? [{ name: "category", value: args.tag }] : undefined,
    });
    if (result.error) {
      return { ok: false, error: result.error.message };
    }
    return { ok: true, id: result.data?.id ?? "unknown" };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? "send_failed" };
  }
}
