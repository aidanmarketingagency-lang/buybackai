"use client";

import { useState } from "react";

interface Props {
  className?: string;
  children: React.ReactNode;
}

export default function BillingPortalButton({ className, children }: Props) {
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } catch {}
    setLoading(false);
  }

  return (
    <button onClick={open} disabled={loading} className={className}>
      {loading ? "Opening…" : children}
    </button>
  );
}
