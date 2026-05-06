"use client";

import { useState } from "react";
import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";

const AGENTS = [
  {
    id: "email_triage",
    name: "Inbox Ivy",
    role: "Email triage",
    body: "Reads everything that lands in your inbox, sorts by urgency, drafts replies in your voice. You wake up to a clean inbox and a stack of one-click drafts.",
    tasks: ["categorize incoming", "draft replies", "flag urgent", "archive newsletters"],
    price: "29",
    saves: "3.5h / wk",
  },
  {
    id: "meeting_prep",
    name: "Meeting Marv",
    role: "Calendar prep",
    body: "Five minutes before any call, you get a one-page brief: who they are, what was said last, three things worth raising. No more walking in cold.",
    tasks: ["research attendees", "pull thread history", "build agenda", "talking points"],
    price: "19",
    saves: "2.0h / wk",
  },
  {
    id: "follow_up",
    name: "Follow-up Fred",
    role: "Loop closer",
    body: "Watches your sent folder. When a thread goes quiet for too long, drafts a nudge in your tone and waits for you to send it.",
    tasks: ["monitor reply status", "draft follow-ups", "time the send", "track open threads"],
    price: "19",
    saves: "1.5h / wk",
  },
  {
    id: "weekly_report",
    name: "Recap Rita",
    role: "Weekly report",
    body: "Every Friday at 4pm: a structured exec summary. What happened this week, key metrics, team updates, priorities for next week. Drafted, ready to send.",
    tasks: ["aggregate activity", "summarize metrics", "exec digest", "send to team"],
    price: "29",
    saves: "2.0h / wk",
  },
  {
    id: "research",
    name: "Recon Rex",
    role: "Deep research",
    body: "Give it a topic — competitor, person, market, concept. Returns a structured brief with sources, key insights, and a summary in under five minutes.",
    tasks: ["web research", "competitor scan", "source-checked", "structured brief"],
    price: "29",
    saves: "3.0h / wk",
  },
  {
    id: "content_repurpose",
    name: "Repurpose Ren",
    role: "Content remixer",
    body: "Drop in a long-form piece — blog, podcast, transcript. Get back LinkedIn posts, an X thread, an email newsletter, and short-form hooks. All in your voice.",
    tasks: ["LinkedIn variants", "X thread", "email newsletter", "short hooks"],
    price: "39",
    saves: "2.0h / wk",
  },
];

export default function AgentsPage() {
  const [deploying, setDeploying] = useState<string | null>(null);
  const [deployed, setDeployed] = useState<string[]>([]);
  const [error, setError] = useState<{ id: string; message: string; upgrade?: boolean } | null>(
    null
  );

  async function deployAgent(agentId: string) {
    setDeploying(agentId);
    setError(null);
    try {
      const res = await fetch("/api/agents/deploy", {
        method: "POST",
        body: JSON.stringify({ type: agentId }),
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setDeployed((prev) => [...prev, agentId]);
        return;
      }
      if (res.status === 401) {
        window.location.href = "/auth/login?next=/agents";
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        upgrade?: boolean;
      };
      if (res.status === 403 && data.upgrade) {
        setError({
          id: agentId,
          message: "You're on the free plan — only one active agent. Upgrade to deploy more.",
          upgrade: true,
        });
        return;
      }
      if (res.status === 409) {
        setError({
          id: agentId,
          message: data.message ?? "You already have this agent active.",
        });
        return;
      }
      setError({
        id: agentId,
        message: data.message ?? data.error ?? "Could not deploy. Try again.",
      });
    } finally {
      setDeploying(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#08090b] text-[#f7f8f8]">
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
            <Link href="/audit" className="hover:text-[#f7f8f8] transition-colors">
              Run audit
            </Link>
            <Link href="/pricing" className="hover:text-[#f7f8f8] transition-colors">
              Pricing
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-16">
        <Reveal className="mb-12 max-w-2xl" amount={0}>
          <p className="eyebrow mb-3">02 — Agents</p>
          <h1 className="display text-4xl sm:text-5xl mb-5">
            Hire one. <span className="serif text-[#d4ff3a]">Watch it work.</span>
            <br />
            Cancel any time.
          </h1>
          <p className="text-[15px] text-[#8a8f98] leading-[1.6]">
            Each agent does one thing well and runs in the background. No prompts to write,
            no workflows to configure. Click hire — they start that hour.
          </p>
        </Reveal>

        {deployed.length > 0 && (
          <div className="mb-8 px-5 py-3 border border-[rgba(212,255,58,0.3)] bg-[rgba(212,255,58,0.04)] flex items-center justify-between reveal">
            <p className="font-mono text-[12px] text-[#d4ff3a] tracking-wider">
              ✓ {deployed.length} AGENT{deployed.length > 1 ? "S" : ""} HIRED · WORKING
            </p>
            <Link
              href="/dashboard"
              className="font-mono text-[12px] text-[#d4ff3a] hover:text-white transition-colors"
            >
              dashboard →
            </Link>
          </div>
        )}

        {error?.upgrade && (
          <div className="mb-8 px-5 py-4 border border-[rgba(212,255,58,0.3)] bg-[rgba(212,255,58,0.04)] flex items-center justify-between gap-4 reveal">
            <p className="text-[13px] text-[#a1a6ae]">{error.message}</p>
            <Link href="/pricing" className="btn btn-accent">
              See plans
              <span aria-hidden>→</span>
            </Link>
          </div>
        )}
        {error && !error.upgrade && (
          <div className="mb-8 px-5 py-3 border border-[rgba(255,138,76,0.3)] bg-[rgba(255,138,76,0.04)] flex items-center justify-between reveal">
            <p className="font-mono text-[12px] text-[#ff8a4c] tracking-wider">{error.message}</p>
            <button
              onClick={() => setError(null)}
              className="font-mono text-[12px] text-[#5d626c] hover:text-[#a1a6ae] transition-colors"
            >
              dismiss
            </button>
          </div>
        )}

        <Stagger className="border-t border-l hairline grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" amount={0.05}>
          {AGENTS.map((agent) => {
            const isDeployed = deployed.includes(agent.id);
            const isDeploying = deploying === agent.id;
            return (
              <StaggerItem
                key={agent.id}
                className="border-r border-b hairline p-7 hover-border bg-[#08090b] flex flex-col agent-card"
              >
                <div className="flex items-baseline justify-between mb-5">
                  <p className="font-mono text-[11px] text-[#5d626c] tracking-wider uppercase">
                    {agent.role}
                  </p>
                  <p className="font-mono tabular text-[15px]">
                    ${agent.price}<span className="text-[#5d626c] text-[11px]">/mo</span>
                  </p>
                </div>
                <h3 className="text-2xl font-medium mb-3 tracking-tight">{agent.name}</h3>
                <p className="text-[14px] leading-[1.55] text-[#8a8f98] mb-6 flex-1">
                  {agent.body}
                </p>
                <div className="border-t hairline pt-4 mb-5">
                  <p className="font-mono text-[11px] text-[#5d626c] tracking-wider mb-2">
                    HANDLES
                  </p>
                  <p className="text-[12px] text-[#a1a6ae] leading-[1.7]">
                    {agent.tasks.map((t, i) => (
                      <span key={t}>
                        {t}
                        {i < agent.tasks.length - 1 && <span className="text-[#3a3e46] mx-1.5">·</span>}
                      </span>
                    ))}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[11px] text-[#d4ff3a] tabular">
                    saves ~{agent.saves}
                  </p>
                  {isDeployed ? (
                    <span className="font-mono text-[12px] text-[#d4ff3a] tracking-wider">
                      ✓ HIRED
                    </span>
                  ) : (
                    <button
                      onClick={() => deployAgent(agent.id)}
                      disabled={isDeploying}
                      className="font-mono text-[12px] text-[#d4ff3a] hover:text-white transition-colors disabled:opacity-50"
                    >
                      {isDeploying ? "hiring..." : "hire →"}
                    </button>
                  )}
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>

        <p className="mt-8 font-mono text-[11px] text-[#5d626c] text-center tracking-wider">
          FREE PLAN · 1 AGENT &nbsp;·&nbsp;{" "}
          <Link href="/pricing" className="text-[#d4ff3a] hover:text-white transition-colors">
            SEE PLANS
          </Link>
        </p>
      </div>
    </div>
  );
}
