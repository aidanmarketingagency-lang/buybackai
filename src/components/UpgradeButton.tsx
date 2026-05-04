"use client";

import { useState } from "react";

interface Props {
  plan: "pro" | "founder";
  className?: string;
  children: React.ReactNode;
  onUnconfigured?: () => void;
}

export default function UpgradeButton({ plan, className, children, onUnconfigured }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.status === 401) {
        window.location.href = "/auth/login?next=/pricing";
        return;
      }
      if (res.status === 503) {
        setError("Billing isn't live yet — coming this week.");
        onUnconfigured?.();
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Could not start checkout.");
      setLoading(false);
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-stretch gap-1">
      <button
        onClick={startCheckout}
        disabled={loading}
        className={className}
      >
        {loading ? "Redirecting…" : children}
      </button>
      {error && (
        <span className="font-mono text-[11px] text-[#ff8a4c] tracking-wider mt-1">{error}</span>
      )}
    </div>
  );
}
