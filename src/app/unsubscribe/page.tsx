import Link from "next/link";
import { verifyUnsubToken } from "@/lib/email/resend";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface SearchParams {
  t?: string;
}

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { t } = await searchParams;
  const userId = t ? verifyUnsubToken(t) : null;

  let status: "ok" | "invalid" | "error" = "invalid";
  if (userId) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ email_unsubscribed_at: new Date().toISOString() })
      .eq("id", userId);
    status = error ? "error" : "ok";
  }

  return (
    <div className="min-h-screen bg-[#08090b] text-[#f7f8f8] flex items-center justify-center px-6">
      <div className="max-w-lg w-full text-center">
        <div className="flex items-center justify-center gap-2.5 mb-12">
          <div className="w-2 h-2 rounded-full bg-[#d4ff3a]" />
          <span className="font-medium tracking-tight text-[15px]">BuybackAI</span>
        </div>
        {status === "ok" && (
          <>
            <p className="eyebrow mb-6">Unsubscribed</p>
            <h1 className="display text-3xl sm:text-4xl mb-6">
              Done. <span className="serif text-[#d4ff3a]">No more emails.</span>
            </h1>
            <p className="text-[15px] text-[#a1a6ae] leading-[1.6] mb-10">
              Your account is still active — agents you&apos;ve hired keep working, and you can
              still review their drafts in the dashboard. We just won&apos;t email you about it.
              Change your mind any time in settings.
            </p>
            <Link href="/dashboard" className="btn btn-ghost">
              Back to dashboard
            </Link>
          </>
        )}
        {status === "invalid" && (
          <>
            <p className="eyebrow mb-6 text-[#ff8a4c]">Invalid link</p>
            <h1 className="display text-3xl sm:text-4xl mb-6">
              That link doesn&apos;t check out.
            </h1>
            <p className="text-[15px] text-[#a1a6ae] leading-[1.6] mb-10">
              The unsubscribe token was missing or didn&apos;t verify. Try clicking the link in the
              most recent email, or sign in to update your preferences directly.
            </p>
            <Link href="/auth/login" className="btn btn-ghost">
              Sign in
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <p className="eyebrow mb-6 text-[#ff8a4c]">Couldn&apos;t complete</p>
            <h1 className="display text-3xl sm:text-4xl mb-6">
              Something broke on our end.
            </h1>
            <p className="text-[15px] text-[#a1a6ae] leading-[1.6] mb-10">
              We couldn&apos;t flip your unsubscribe flag. Try again, or reply to any email and we&apos;ll
              fix it manually.
            </p>
            <Link href="/" className="btn btn-ghost">
              Home
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
