"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  async function handleGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes:
          "email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/calendar.readonly",
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        // Required so Google reliably returns a refresh token (see signup).
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
            href="/auth/signup"
            className="text-sm text-[#8a8f98] hover:text-[#f7f8f8] transition-colors"
          >
            Start free
          </Link>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-sm w-full reveal">
          <p className="eyebrow mb-3">Sign in</p>
          <h1 className="display text-3xl sm:text-4xl mb-4">
            Welcome <span className="serif text-[#d4ff3a]">back.</span>
          </h1>
          <p className="text-[15px] text-[#8a8f98] leading-[1.6] mb-10">
            Pick up where your agents left off.
          </p>

          <button
            onClick={handleGoogleLogin}
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

          <p className="font-mono text-[11px] text-[#5d626c] text-center mt-8 tracking-wider">
            NEW HERE?{" "}
            <Link
              href="/auth/signup"
              className="text-[#d4ff3a] hover:text-white transition-colors"
            >
              START FREE
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
