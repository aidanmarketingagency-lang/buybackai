"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function SignupForm() {
  // We intentionally ignore any `plan` query param here. Plan upgrades can
  // only happen through the (future) billing webhook, never client-supplied
  // strings. This keeps the signup CTA copy honest with the eventual entitlement.
  useSearchParams();

  async function handleGoogleSignup() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes:
          "email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/calendar.readonly",
        redirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        // access_type=offline + prompt=consent are REQUIRED for Google to
        // return a refresh token, which the cron uses to keep Gmail polling
        // working past the 1-hour access-token expiry. Without these, Inbox
        // Ivy silently dies an hour after signup.
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  }

  return (
    <div className="min-h-screen bg-[#08090b] text-[#f7f8f8] flex flex-col">
      <nav className="border-b hairline">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-[#d4ff3a]" />
            <span className="font-medium tracking-tight text-[15px]">BuybackAI</span>
          </Link>
          <Link
            href="/auth/login"
            className="text-sm text-[#8a8f98] hover:text-[#f7f8f8] transition-colors"
          >
            Sign in
          </Link>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full reveal">
          <p className="eyebrow mb-3">Get started</p>
          <h1 className="display text-3xl sm:text-4xl mb-4">
            Run your <span className="serif text-[#d4ff3a]">first audit.</span>
          </h1>
          <p className="text-[15px] text-[#8a8f98] leading-[1.6] mb-10">
            Connect Gmail and Calendar. We&apos;ll show you where your week is going in two minutes.
          </p>

          <div className="border-y hairline py-5 mb-8 space-y-3">
            <p className="font-mono text-[11px] text-[#5d626c] tracking-wider mb-3">YOU&apos;LL GET</p>
            {[
              "Top 5 Time Thieves with hours per week",
              "Dollar cost at your hourly rate",
              "Which tasks an agent can take today",
            ].map((item, i) => (
              <p key={item} className="text-[14px] text-[#a1a6ae] flex items-baseline gap-3">
                <span className="font-mono text-[11px] text-[#d4ff3a] tabular shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {item}
              </p>
            ))}
          </div>

          <button
            onClick={handleGoogleSignup}
            className="w-full flex items-center justify-center gap-3 bg-[#f7f8f8] hover:bg-white text-black font-medium py-3 rounded transition-colors text-[14px]"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          <p className="font-mono text-[11px] text-[#5d626c] mt-5 tracking-wider leading-[1.7]">
            READS GMAIL + CALENDAR
            <br />
            CREATES DRAFTS WHEN YOU APPROVE A REPLY
            <br />
            NEVER SENDS EMAIL ON ITS OWN
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
