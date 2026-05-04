"use client";

import Link from "next/link";
import { useState } from "react";
import type { PublicProfile, PublicAgent, PublicAgentAction, PublicAudit } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

function ActionRow({
  action,
  onApprove,
  onDismiss,
}: {
  action: PublicAgentAction;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const content = action.content as {
    from?: string;
    subject?: string;
    snippet?: string;
    draft?: string | null;
    category?: string;
    priority?: string;
  };
  const hasDetails = !!(content.subject || content.draft || content.snippet);

  return (
    <div className="border-b hairline">
      <div className="py-4 grid grid-cols-12 gap-3 items-baseline">
        <div className="col-span-1 font-mono text-[11px] text-[#5d626c]">
          {new Date(action.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
        <div
          className={`col-span-7 sm:col-span-8 ${hasDetails ? "cursor-pointer" : ""}`}
          onClick={() => hasDetails && setExpanded((e) => !e)}
        >
          <p className="text-[14px] text-[#d4d8de] mb-0.5">{action.summary}</p>
          <p className="font-mono text-[11px] text-[#5d626c] tracking-wider uppercase flex items-center gap-2">
            <span>{action.type.replace("_", " ")}</span>
            {content.priority && (
              <>
                <span className="text-[#3a3e46]">·</span>
                <span
                  className={
                    content.priority === "high"
                      ? "text-[#ff8a4c]"
                      : content.priority === "medium"
                      ? "text-[#d4ff3a]"
                      : "text-[#5d626c]"
                  }
                >
                  {content.priority}
                </span>
              </>
            )}
            {hasDetails && (
              <>
                <span className="text-[#3a3e46]">·</span>
                <span className="text-[#5d626c]">{expanded ? "hide" : "view"}</span>
              </>
            )}
          </p>
        </div>
        <div className="col-span-4 sm:col-span-3 flex justify-end gap-2">
          <button
            onClick={onApprove}
            className="text-[12px] font-mono text-[#d4ff3a] hover:text-white transition-colors"
          >
            approve
          </button>
          <span className="text-[#3a3e46]">·</span>
          <button
            onClick={onDismiss}
            className="text-[12px] font-mono text-[#5d626c] hover:text-[#a1a6ae] transition-colors"
          >
            dismiss
          </button>
        </div>
      </div>
      {expanded && hasDetails && (
        <div className="pb-4 pl-[calc(8.33%+12px)] pr-3 space-y-3 reveal">
          {content.from && (
            <div className="text-[12px] text-[#8a8f98]">
              <span className="font-mono text-[#5d626c] tracking-wider">FROM&nbsp;</span>
              {content.from}
            </div>
          )}
          {content.subject && (
            <div className="text-[13px] text-[#d4d8de]">
              <span className="font-mono text-[#5d626c] tracking-wider text-[11px] block mb-0.5">
                SUBJECT
              </span>
              {content.subject}
            </div>
          )}
          {content.snippet && (
            <div className="text-[13px] text-[#a1a6ae] leading-[1.5]">
              <span className="font-mono text-[#5d626c] tracking-wider text-[11px] block mb-0.5">
                EXCERPT
              </span>
              {content.snippet}
            </div>
          )}
          {content.draft && (
            <div className="border hairline bg-[#0a0b0d] p-3">
              <span className="font-mono text-[#d4ff3a] tracking-wider text-[11px] block mb-2">
                DRAFTED REPLY
              </span>
              <pre className="text-[13px] text-[#d4d8de] whitespace-pre-wrap font-sans leading-[1.55] m-0">
                {content.draft}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  profile: PublicProfile | null;
  agents: PublicAgent[];
  actions: PublicAgentAction[];
  latestAudit: PublicAudit | null;
}

export default function DashboardClient({ profile, agents, actions, latestAudit }: Props) {
  const router = useRouter();
  const hourlyRate = profile?.hourly_rate || 250;

  const totalHoursSaved = agents.reduce((sum, a) => sum + a.hours_saved, 0);
  const totalDollarValue = totalHoursSaved * hourlyRate;
  const buybackScore =
    agents.length > 0
      ? Math.min(
          100,
          Math.round(
            (agents.filter((a) => a.status === "active").length / Math.max(agents.length, 5)) * 100
          )
        )
      : 0;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleAction(id: string, status: "approved" | "dismissed") {
    await fetch(`/api/agents/actions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      headers: { "Content-Type": "application/json" },
    });
    router.refresh();
  }

  const firstName = profile?.full_name?.split(" ")[0] || "founder";

  return (
    <div className="min-h-screen bg-[#08090b] text-[#f7f8f8] flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-60 border-r hairline flex-col fixed inset-y-0 z-40">
        <div className="px-5 h-14 flex items-center gap-2.5 border-b hairline">
          <div className="w-2 h-2 rounded-full bg-[#d4ff3a]" />
          <span className="font-medium tracking-tight text-[15px]">BuybackAI</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {[
            { label: "Dashboard", href: "/dashboard", active: true },
            { label: "Agents", href: "/agents", active: false },
            { label: "Run audit", href: "/audit", active: false },
            { label: "Master prompt", href: "/onboarding", active: false },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded text-sm transition-colors ${
                item.active
                  ? "bg-[rgba(255,255,255,0.04)] text-[#f7f8f8]"
                  : "text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-[rgba(255,255,255,0.02)]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t hairline">
          <div className="px-3 py-2 mb-1">
            <p className="text-[13px] font-medium truncate">{profile?.full_name || profile?.email}</p>
            <p className="font-mono text-[11px] text-[#5d626c] tracking-wider uppercase mt-0.5">
              {profile?.plan} plan
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="block px-3 py-2 w-full text-left text-sm text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-[rgba(255,255,255,0.02)] rounded transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 lg:ml-60">
        {/* Mobile nav */}
        <nav className="lg:hidden border-b hairline">
          <div className="px-6 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-[#d4ff3a]" />
              <span className="font-medium tracking-tight text-[15px]">BuybackAI</span>
            </Link>
            <Link href="/agents" className="text-sm text-[#8a8f98]">
              Agents
            </Link>
          </div>
        </nav>

        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="mb-12">
            <p className="eyebrow mb-3">Dashboard</p>
            <h1 className="display text-3xl sm:text-4xl">
              Welcome back, <span className="serif text-[#d4ff3a]">{firstName}.</span>
            </h1>
          </div>

          {/* Stats — three columns separated by hairlines, no boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 border-y hairline divide-y sm:divide-y-0 sm:divide-x divide-[rgba(255,255,255,0.06)] mb-12">
            <div className="px-6 py-6">
              <p className="font-mono text-[11px] text-[#5d626c] tracking-wider mb-2">
                HOURS SAVED · WEEK
              </p>
              <p className="text-3xl font-medium tabular">
                {totalHoursSaved.toFixed(1)}<span className="text-[#5d626c] text-xl">h</span>
              </p>
              {agents.length > 0 && (
                <p className="text-[12px] text-[#5d626c] mt-2">
                  across {agents.length} agent{agents.length > 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="px-6 py-6">
              <p className="font-mono text-[11px] text-[#5d626c] tracking-wider mb-2">
                VALUE RECOVERED
              </p>
              <p className="text-3xl font-medium tabular text-[#d4ff3a]">
                ${totalDollarValue.toLocaleString()}
              </p>
              <p className="text-[12px] text-[#5d626c] mt-2">@ ${hourlyRate}/hr</p>
            </div>
            <div className="px-6 py-6">
              <p className="font-mono text-[11px] text-[#5d626c] tracking-wider mb-2">
                BUYBACK SCORE
              </p>
              <p className="text-3xl font-medium tabular">
                {buybackScore}<span className="text-[#5d626c] text-xl">/100</span>
              </p>
              <div className="mt-3 h-px bg-[rgba(255,255,255,0.06)] relative">
                <div
                  className="absolute inset-y-0 left-0 bg-[#d4ff3a] transition-all"
                  style={{ width: `${buybackScore}%`, height: "1px" }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Inbox */}
            <div className="lg:col-span-2">
              <div className="flex items-baseline justify-between mb-6">
                <p className="eyebrow">Inbox · needs your call</p>
                {actions.length > 0 && (
                  <span className="font-mono text-[11px] text-[#d4ff3a] tabular">
                    {String(actions.length).padStart(2, "0")} pending
                  </span>
                )}
              </div>
              {actions.length === 0 ? (
                <div className="border-y hairline py-16 text-center">
                  <p className="font-mono text-[11px] text-[#5d626c] tracking-wider mb-2">
                    INBOX EMPTY
                  </p>
                  <p className="text-[#a1a6ae] text-[14px]">All caught up. Agents are working.</p>
                </div>
              ) : (
                <div className="border-t hairline">
                  {actions.map((action) => (
                    <ActionRow
                      key={action.id}
                      action={action}
                      onApprove={() => handleAction(action.id, "approved")}
                      onDismiss={() => handleAction(action.id, "dismissed")}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Agents */}
            <div>
              <div className="flex items-baseline justify-between mb-6">
                <p className="eyebrow">Active agents</p>
                <Link
                  href="/agents"
                  className="font-mono text-[11px] text-[#d4ff3a] hover:text-white transition-colors"
                >
                  + add
                </Link>
              </div>
              {agents.length === 0 ? (
                <div className="border-y hairline py-12 text-center">
                  <p className="font-mono text-[11px] text-[#5d626c] tracking-wider mb-3">
                    NO AGENTS YET
                  </p>
                  {!latestAudit ? (
                    <Link
                      href="/audit"
                      className="text-[13px] text-[#d4ff3a] hover:text-white transition-colors font-mono"
                    >
                      run audit first →
                    </Link>
                  ) : (
                    <Link
                      href="/agents"
                      className="text-[13px] text-[#d4ff3a] hover:text-white transition-colors font-mono"
                    >
                      browse agents →
                    </Link>
                  )}
                </div>
              ) : (
                <div className="border-t hairline">
                  {agents.slice(0, 6).map((agent) => (
                    <div key={agent.id} className="border-b hairline py-4">
                      <div className="flex items-baseline justify-between mb-1">
                        <p className="text-[14px] font-medium">{agent.name}</p>
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            agent.status === "active"
                              ? "bg-[#d4ff3a] pulse-soft"
                              : "bg-[#3a3e46]"
                          }`}
                        />
                      </div>
                      <p className="font-mono text-[11px] text-[#5d626c] tracking-wider tabular">
                        {agent.tasks_completed} runs · {agent.hours_saved.toFixed(1)}h saved
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {!latestAudit && (
                <div className="mt-8 pt-8 border-t hairline">
                  <p className="text-[14px] text-[#a1a6ae] mb-4 leading-[1.55]">
                    You haven&apos;t run your audit yet. That&apos;s the fastest way to know which agents
                    will pay for themselves.
                  </p>
                  <Link href="/audit" className="btn btn-accent">
                    Run audit
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
