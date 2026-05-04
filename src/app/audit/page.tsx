"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { TimeThief } from "@/types/database";

type AuditStatus = "idle" | "analyzing" | "complete" | "error";

const ANALYSIS_STEPS = [
  "connecting gmail.api ........",
  "reading 14d window .........",
  "connecting calendar.api ....",
  "reading event log 14d ......",
  "categorizing with claude ...",
  "calculating buyback value ..",
  "generating report ..........",
];

export default function AuditPage() {
  const router = useRouter();
  const [status, setStatus] = useState<AuditStatus>("idle");
  const [currentStep, setCurrentStep] = useState(0);
  const [timeThieves, setTimeThieves] = useState<TimeThief[]>([]);
  const [hourlyRate, setHourlyRate] = useState(300);

  const totalHours = timeThieves.reduce((sum, t) => sum + t.hours_per_week, 0);
  const totalCost = totalHours * hourlyRate;

  async function runAudit() {
    setStatus("analyzing");
    setCurrentStep(0);

    const interval = setInterval(() => {
      setCurrentStep((p) => (p < ANALYSIS_STEPS.length - 1 ? p + 1 : p));
    }, 1100);

    try {
      const res = await fetch("/api/audit", { method: "POST" });
      clearInterval(interval);
      if (!res.ok) throw new Error("audit failed");
      const data = await res.json();
      setTimeThieves(data.timeThieves);
      setStatus("complete");
    } catch {
      clearInterval(interval);
      setStatus("error");
    }
  }

  // ─── IDLE ───────────────────────────────
  if (status === "idle") {
    return (
      <div className="min-h-screen bg-[#08090b] text-[#f7f8f8] flex flex-col">
        <Nav />
        <div className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="max-w-xl w-full reveal">
            <p className="eyebrow mb-6">Step 01 — Audit</p>
            <h1 className="display text-4xl sm:text-5xl mb-6">
              Find the weeks you&apos;re <span className="serif text-[#d4ff3a]">losing.</span>
            </h1>
            <p className="text-[15px] text-[#8a8f98] leading-[1.6] mb-10">
              We&apos;ll read 14 days of email and calendar activity, sort it by what an agent could
              do, and put a price tag on it. Takes about 30 seconds.
            </p>

            <div className="card p-5 mb-8">
              <p className="font-mono text-[11px] text-[#5d626c] tracking-wider mb-3">YOUR HOURLY RATE</p>
              <div className="flex items-center gap-2">
                <span className="text-[#5d626c] font-mono">$</span>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value) || 0)}
                  className="bg-transparent border-b border-[rgba(255,255,255,0.12)] focus:border-[#d4ff3a] px-1 py-1.5 text-3xl font-medium tabular w-32 outline-none transition-colors"
                />
                <span className="text-[#5d626c] text-sm font-mono">/hour</span>
              </div>
              <p className="text-[12px] text-[#5d626c] mt-3">
                Use your consulting rate, or what you&apos;d charge if someone bought your time today.
              </p>
            </div>

            <button onClick={runAudit} className="btn btn-accent w-full justify-center">
              Run my audit
              <span aria-hidden>→</span>
            </button>
            <p className="mt-4 font-mono text-[11px] text-[#5d626c]">
              read-only · we never modify mail or calendar
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── ANALYZING ──────────────────────────
  if (status === "analyzing") {
    return (
      <div className="min-h-screen bg-[#08090b] text-[#f7f8f8] flex flex-col">
        <Nav />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="card max-w-lg w-full">
            <div className="px-4 py-2.5 border-b hairline flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4ff3a] pulse-soft" />
              <span className="font-mono text-[11px] text-[#5d626c] tracking-wider">
                AUDIT.LOG · running
              </span>
            </div>
            <pre className="p-5 m-0 font-mono text-[13px] leading-[1.8] text-[#a1a6ae] whitespace-pre-wrap">
              {ANALYSIS_STEPS.map((step, i) => {
                const status =
                  i < currentStep ? "✓" : i === currentStep ? "·" : " ";
                const color =
                  i < currentStep
                    ? "text-[#5d626c]"
                    : i === currentStep
                    ? "text-[#d4ff3a]"
                    : "text-[#3a3e46]";
                return (
                  <div key={i} className={color}>
                    <span className="mr-2">{status}</span>
                    {step}
                  </div>
                );
              })}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // ─── ERROR ──────────────────────────────
  if (status === "error") {
    return (
      <div className="min-h-screen bg-[#08090b] text-[#f7f8f8] flex flex-col">
        <Nav />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <p className="font-mono text-[11px] text-[#5d626c] tracking-wider mb-4">
              ERROR · AUDIT FAILED
            </p>
            <p className="text-[#a1a6ae] mb-8 text-[15px]">
              Something broke on our end. Try again, or reach out to{" "}
              <a href="mailto:hello@buybackai.com" className="text-[#d4ff3a]">
                hello@buybackai.com
              </a>
              .
            </p>
            <button onClick={() => setStatus("idle")} className="btn btn-ghost">
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── COMPLETE ───────────────────────────
  return (
    <div className="min-h-screen bg-[#08090b] text-[#f7f8f8]">
      <Nav />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12 reveal">
          <p className="eyebrow mb-3">01 — Audit · complete</p>
          <h1 className="display text-4xl sm:text-5xl mb-6">
            Here&apos;s where your <span className="serif text-[#d4ff3a]">week went.</span>
          </h1>
          <div className="flex flex-wrap gap-x-10 gap-y-4 items-baseline">
            <div>
              <p className="font-mono text-[11px] text-[#5d626c] tracking-wider mb-1">
                HOURS / WEEK
              </p>
              <p className="text-3xl font-medium tabular">{totalHours.toFixed(1)}h</p>
            </div>
            <div>
              <p className="font-mono text-[11px] text-[#5d626c] tracking-wider mb-1">
                AT ${hourlyRate}/HR
              </p>
              <p className="text-3xl font-medium tabular text-[#d4ff3a]">
                ${totalCost.toLocaleString()}/wk
              </p>
            </div>
            <div>
              <p className="font-mono text-[11px] text-[#5d626c] tracking-wider mb-1">
                AGENTS AVAILABLE
              </p>
              <p className="text-3xl font-medium tabular">{timeThieves.length}</p>
            </div>
          </div>
        </div>

        <div className="border-t hairline reveal-1">
          {timeThieves.map((thief, i) => (
            <div key={thief.id} className="border-b hairline py-6 grid grid-cols-12 gap-4 items-baseline">
              <div className="col-span-1 font-mono text-[11px] text-[#5d626c] tracking-wider">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="col-span-7">
                <h3 className="text-[17px] font-medium mb-1">{thief.title}</h3>
                <p className="text-[14px] text-[#8a8f98] leading-[1.55] mb-3">
                  {thief.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {thief.examples.map((ex) => (
                    <span
                      key={ex}
                      className="font-mono text-[11px] text-[#5d626c] tracking-wide"
                    >
                      {ex}
                      {thief.examples.indexOf(ex) < thief.examples.length - 1 && (
                        <span className="ml-1.5 text-[#3a3e46]">·</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
              <div className="col-span-2 text-right">
                <p className="text-[15px] font-medium tabular">
                  {thief.hours_per_week}h
                </p>
                <p className="text-[11px] text-[#5d626c] font-mono tabular">
                  ${(thief.hours_per_week * hourlyRate).toLocaleString()}/wk
                </p>
              </div>
              <div className="col-span-2 text-right">
                <p className="text-[11px] text-[#5d626c] font-mono tracking-wider mb-1">
                  AGENT
                </p>
                <p className="text-[13px] text-[#a1a6ae]">{thief.recommended_agent}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 reveal-2">
          <p className="text-[14px] text-[#8a8f98] max-w-md">
            That&apos;s {totalHours.toFixed(1)} hours a week worth taking back. Hire your first agent
            and start clawing it back today.
          </p>
          <button onClick={() => router.push("/agents")} className="btn btn-accent shrink-0">
            Browse agents
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Nav() {
  return (
    <nav className="border-b hairline">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-[#d4ff3a]" />
          <span className="font-medium tracking-tight text-[15px]">BuybackAI</span>
        </Link>
        <div className="flex items-center gap-6 text-sm text-[#8a8f98]">
          <Link href="/dashboard" className="hover:text-[#f7f8f8] transition-colors">
            Dashboard
          </Link>
          <Link href="/agents" className="hover:text-[#f7f8f8] transition-colors">
            Agents
          </Link>
        </div>
      </div>
    </nav>
  );
}
