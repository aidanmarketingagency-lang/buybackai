import Link from "next/link";

const AGENTS = [
  {
    id: "inbox-ivy",
    name: "Inbox Ivy",
    role: "Email triage",
    body: "Reads everything, sorts by urgency, drafts replies in your voice. You wake up to a clean inbox and 12 drafts waiting for one click.",
    price: "$29",
    unit: "/mo",
    sample: "Re: Q3 contract — drafted reply",
  },
  {
    id: "meeting-marv",
    name: "Meeting Marv",
    role: "Calendar prep",
    body: "Five minutes before any call: a one-page brief on the person, the company, the last six emails, and three things worth raising.",
    price: "$19",
    unit: "/mo",
    sample: "Brief ready: Sarah at Acme — 3 talking points",
  },
  {
    id: "follow-up-fred",
    name: "Follow-up Fred",
    role: "Loop closer",
    body: "Watches your sent folder. When a thread goes quiet for too long, drafts a nudge in your tone and waits for you to send.",
    price: "$19",
    unit: "/mo",
    sample: "3 leads cold for 4+ days. Drafts queued.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#08090b] text-[#f7f8f8]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b hairline bg-[#08090b]/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-[#d4ff3a]" />
            <span className="font-medium tracking-tight text-[15px]">BuybackAI</span>
            <span className="chip ml-1">v0.1 · invite-only</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-[#8a8f98]">
            <a href="#agents" className="hover:text-[#f7f8f8] transition-colors">Agents</a>
            <a href="#how" className="hover:text-[#f7f8f8] transition-colors">How it works</a>
            <Link href="/pricing" className="hover:text-[#f7f8f8] transition-colors">Pricing</Link>
            <a href="#manifesto" className="hover:text-[#f7f8f8] transition-colors">Manifesto</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-[#8a8f98] hover:text-[#f7f8f8] transition-colors hidden sm:block">
              Sign in
            </Link>
            <Link href="/auth/signup" className="btn btn-accent">
              Start audit
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero — left-aligned, asymmetric, no centered template */}
      <section className="relative">
        <div className="absolute inset-0 subtle-grid pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-end">
          <div className="lg:col-span-7 reveal">
            <p className="eyebrow mb-8">Buyback OS · Beta</p>
            <h1 className="display text-5xl sm:text-6xl lg:text-7xl mb-7">
              Hire an AI agent
              <br />
              the way you&apos;d <span className="serif text-[#d4ff3a]">hire a contractor.</span>
            </h1>
            <p className="text-[17px] leading-[1.55] text-[#a1a6ae] max-w-xl mb-10">
              BuybackAI is a marketplace of focused AI agents. Each one takes a piece of your week
              you shouldn&apos;t still be doing yourself. You audit what&apos;s eating your time, hire one,
              and pay only while it&apos;s working.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/auth/signup" className="btn btn-accent">
                Run a 2-minute audit
                <span aria-hidden>→</span>
              </Link>
              <Link href="#agents" className="btn btn-ghost">
                Browse agents
              </Link>
            </div>
            <p className="mt-6 text-[13px] text-[#5d626c]">
              Read-only Gmail and Calendar access. We never send mail without you.
            </p>
          </div>

          {/* Right side: a real-feeling product surface, NOT a fake browser */}
          <div className="lg:col-span-5 reveal-2">
            <div className="card p-0">
              <div className="px-4 py-2.5 border-b hairline flex items-center justify-between">
                <span className="font-mono text-[11px] text-[#5d626c] tracking-wider">
                  AUDIT.RESULT
                </span>
                <span className="font-mono text-[11px] text-[#d4ff3a] flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#d4ff3a] pulse-soft" />
                  fresh
                </span>
              </div>
              <div className="p-5">
                <p className="text-[12px] text-[#5d626c] mb-1 font-mono">last 14 days</p>
                <p className="text-[15px] text-[#a1a6ae] mb-5">
                  At your $300/hr rate, you spent
                  <span className="text-[#f7f8f8] font-medium"> 11h 24m </span>
                  on tasks an agent can do.
                </p>
                <div className="space-y-3">
                  {[
                    { label: "Sorting and replying to email", h: "4h 12m", cost: "$1,260", agent: "Inbox Ivy" },
                    { label: "Prep for back-to-back meetings", h: "3h 18m", cost: "$990", agent: "Meeting Marv" },
                    { label: "Following up on quiet threads", h: "2h 06m", cost: "$630", agent: "Follow-up Fred" },
                    { label: "Repurposing a podcast clip", h: "1h 48m", cost: "$540", agent: "—" },
                  ].map((row, i) => (
                    <div key={i} className="flex items-baseline justify-between text-[13px] gap-3">
                      <span className="text-[#a1a6ae] truncate">{row.label}</span>
                      <span className="font-mono tabular text-[#f7f8f8] shrink-0">{row.h}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t hairline flex items-baseline justify-between">
                  <span className="font-mono text-[11px] text-[#5d626c] tracking-wider">RECOVERABLE</span>
                  <span className="font-mono tabular text-[15px] text-[#d4ff3a]">$3,420 / wk</span>
                </div>
              </div>
            </div>
            <p className="mt-3 font-mono text-[11px] text-[#4d525c] text-right">
              fig 0.1 — sample audit, real format
            </p>
          </div>
        </div>
      </section>

      {/* The pull-quote — the Anthropic / serif move */}
      <section className="border-t hairline">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <p className="serif text-3xl sm:text-4xl lg:text-5xl text-[#f7f8f8] leading-tight">
            &ldquo;Most founders aren&apos;t starved for tools.
            <br className="hidden sm:block" />
            They&apos;re drowning in $20-an-hour work
            <br className="hidden sm:block" />
            wearing a CEO&apos;s hat.&rdquo;
          </p>
          <p className="mt-6 text-[13px] text-[#5d626c]">
            — the premise
          </p>
        </div>
      </section>

      {/* 01 Audit — Each section uses a different layout */}
      <section id="how" className="border-t hairline">
        <div className="max-w-6xl mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4">
            <p className="eyebrow mb-3">01 — Audit</p>
            <h2 className="display text-3xl sm:text-4xl mb-4">
              Find the weeks you didn&apos;t know you were losing.
            </h2>
            <p className="text-[15px] leading-[1.6] text-[#8a8f98]">
              Connect Gmail and Calendar. We read 14 days of activity, sort it by category, and
              show you where your hours actually went. You set your hourly rate; we put a price
              tag on the leak.
            </p>
          </div>
          <div className="lg:col-span-8">
            <div className="card font-mono text-[13px] leading-[1.7]">
              <div className="px-4 py-2.5 border-b hairline flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#d4ff3a] pulse-soft" />
                <span className="text-[11px] text-[#5d626c] tracking-wider">AUDIT.LOG · live</span>
              </div>
              <pre className="p-5 text-[#a1a6ae] whitespace-pre-wrap m-0 overflow-x-auto">
{`> connecting gmail.aidan@... ✓
> reading 14d window ........ 487 threads
> reading calendar 14d ...... 62 events
> categorizing with claude .. done
> mapping to known agents ... done

  ┌── time leak ───────────────────────────────┐
  │  email triage          4h 12m   $1,260     │
  │  meeting prep          3h 18m   $990       │
  │  follow-ups            2h 06m   $630       │
  │  content repurposing   1h 48m   $540       │
  └──────────────────────────────────────────────┘

> recoverable / week ........ $3,420
> agents available .......... 3 of 4`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* 02 Agents — three real-feeling cards, no rainbow palette */}
      <section id="agents" className="border-t hairline">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-12 gap-4">
            <div className="max-w-xl">
              <p className="eyebrow mb-3">02 — Agents</p>
              <h2 className="display text-3xl sm:text-4xl mb-4">
                Three agents at launch. <span className="serif text-[#8a8f98]">Eight by year-end.</span>
              </h2>
              <p className="text-[15px] leading-[1.6] text-[#8a8f98]">
                Every agent does one thing well. No frameworks, no prompt engineering, no
                workflow builders. Hire one, watch it work, fire it the same day if it doesn&apos;t.
              </p>
            </div>
            <Link href="/agents" className="text-sm text-[#d4ff3a] hover:text-white transition-colors font-mono tracking-wide">
              all agents →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 border-t border-l hairline">
            {AGENTS.map((agent) => (
              <div key={agent.id} className="border-r border-b hairline p-7 hover-border bg-[#08090b]">
                <div className="flex items-baseline justify-between mb-6">
                  <p className="font-mono text-[11px] text-[#5d626c] tracking-wider uppercase">
                    {agent.role}
                  </p>
                  <p className="font-mono tabular text-[#f7f8f8]">
                    {agent.price}<span className="text-[#5d626c] text-[11px]">{agent.unit}</span>
                  </p>
                </div>
                <h3 className="text-2xl font-medium mb-3 tracking-tight">{agent.name}</h3>
                <p className="text-[14px] leading-[1.55] text-[#8a8f98] mb-6 min-h-[88px]">
                  {agent.body}
                </p>
                <div className="border-t hairline pt-4">
                  <p className="font-mono text-[11px] text-[#5d626c] mb-1.5 tracking-wider">
                    LAST RUN
                  </p>
                  <p className="text-[13px] text-[#a1a6ae] truncate">{agent.sample}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 03 The thread — Linear-style real conversation */}
      <section className="border-t hairline">
        <div className="max-w-6xl mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5 lg:order-2">
            <p className="eyebrow mb-3">03 — Approve</p>
            <h2 className="display text-3xl sm:text-4xl mb-4">
              Nothing leaves without you.
            </h2>
            <p className="text-[15px] leading-[1.6] text-[#8a8f98]">
              Agents draft. You decide. Every reply, every send, every booked meeting goes
              through a one-line approval. Your inbox stays yours; the typing just stops being
              your problem.
            </p>
          </div>
          <div className="lg:col-span-7 lg:order-1 card divide-y divide-[rgba(255,255,255,0.06)]">
            {[
              { who: "Inbox Ivy", time: "06:42", text: "Drafted reply to Marcus re: extending the trial. Matches the tone you used with Lena last week.", action: "Approve & send" },
              { who: "Meeting Marv", time: "08:55", text: "9am call with Sarah Chen (Acme). Last touch was Mar 12. They asked about pricing for 50+ seats.", action: "Open brief" },
              { who: "Follow-up Fred", time: "10:11", text: "3 threads gone quiet. Drafts queued. None of them sound like a robot, I checked.", action: "Review (3)" },
            ].map((m, i) => (
              <div key={i} className="px-5 py-4 flex items-start gap-4">
                <div className="w-7 h-7 rounded-full bg-[rgba(212,255,58,0.15)] border border-[rgba(212,255,58,0.3)] shrink-0 flex items-center justify-center">
                  <span className="font-mono text-[10px] text-[#d4ff3a]">
                    {m.who.split(" ").map(w => w[0]).join("")}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-medium">{m.who}</span>
                    <span className="font-mono text-[11px] text-[#5d626c]">{m.time}</span>
                  </div>
                  <p className="text-sm text-[#a1a6ae] leading-relaxed mb-2">{m.text}</p>
                  <button className="text-[12px] font-mono text-[#d4ff3a] hover:text-white transition-colors">
                    {m.action} →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Manifesto — the editorial / Anthropic move */}
      <section id="manifesto" className="border-t hairline bg-[#0a0b0d]">
        <div className="max-w-3xl mx-auto px-6 py-32">
          <p className="eyebrow mb-8">Why a marketplace, not a framework.</p>
          <div className="serif text-[24px] sm:text-[28px] leading-[1.4] text-[#d4d8de] space-y-6">
            <p>
              Every other AI tool wants to teach you how to build agents. Frameworks. Workflow
              canvases. Node graphs. Prompt libraries.
            </p>
            <p>
              Founders don&apos;t need another thing to learn. They need someone to do the work.
            </p>
            <p>
              We&apos;re betting agents become a category like apps did — finite, named, opinionated,
              priced. Not infinite Lego bricks. <span className="text-[#d4ff3a]">Hire and fire, not configure.</span>
            </p>
          </div>
          <p className="mt-10 text-[13px] text-[#5d626c] font-mono">
            — Aidan, founder
          </p>
        </div>
      </section>

      {/* Pricing — three tiers, free / pro / founder */}
      <section id="pricing" className="border-t hairline">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="mb-12 max-w-xl">
            <p className="eyebrow mb-3">04 — Pricing</p>
            <h2 className="display text-3xl sm:text-4xl mb-4">
              Pay for the hours back, not the software.
            </h2>
            <p className="text-[15px] leading-[1.6] text-[#8a8f98]">
              Free audit, free first agent. When time saved is worth more than dinner, upgrade.
            </p>
          </div>
          <div className="border-t border-l hairline grid grid-cols-1 md:grid-cols-3">
            {[
              {
                name: "Free",
                price: "$0",
                unit: "forever",
                body: "Run the audit. One active agent (Inbox Ivy). Cancel any time — there's nothing to cancel.",
                bullets: ["1 active agent", "Free audit, anytime", "Email triage"],
              },
              {
                name: "Pro",
                price: "$49",
                unit: "/mo",
                body: "All three agents working full-time. The point at which you stop noticing them.",
                bullets: ["Up to 5 agents", "Ivy + Marv + Fred", "Hourly meeting briefs"],
                highlight: true,
              },
              {
                name: "Founder",
                price: "$149",
                unit: "/mo",
                body: "Unlimited agents. Custom agent requests. Direct line to me. Quarterly buyback strategy call.",
                bullets: ["Unlimited agents", "Custom agent requests", "Founder Slack"],
              },
            ].map((p) => (
              <div
                key={p.name}
                className={`border-r border-b hairline p-7 hover-border ${
                  p.highlight ? "bg-[rgba(212,255,58,0.02)]" : ""
                }`}
              >
                <div className="flex items-baseline justify-between mb-4">
                  <p className="font-mono text-[11px] text-[#5d626c] tracking-wider uppercase">
                    {p.name}
                  </p>
                  {p.highlight && (
                    <span className="font-mono text-[11px] text-[#d4ff3a] tracking-wider">
                      MOST POPULAR
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-medium tabular">{p.price}</span>
                  <span className="text-[#5d626c] text-sm">{p.unit}</span>
                </div>
                <p className="text-[13px] leading-[1.55] text-[#8a8f98] mb-5">{p.body}</p>
                <ul className="space-y-1.5 mb-6">
                  {p.bullets.map((b) => (
                    <li key={b} className="text-[12px] text-[#a1a6ae] flex items-start gap-2">
                      <span className="text-[#d4ff3a] shrink-0">→</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <Link href="/pricing" className="btn btn-accent">
              See full pricing
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA — quieter than the hero */}
      <section className="border-t hairline">
        <div className="max-w-4xl mx-auto px-6 py-32 text-center">
          <h2 className="display text-3xl sm:text-5xl mb-6">
            Audit takes <span className="serif text-[#d4ff3a]">two minutes.</span>
          </h2>
          <p className="text-[15px] text-[#8a8f98] max-w-md mx-auto mb-10">
            If we can&apos;t show you five hours a week worth taking back, you keep the report and we
            never bill you.
          </p>
          <Link href="/auth/signup" className="btn btn-accent">
            Connect Gmail and run my audit
            <span aria-hidden>→</span>
          </Link>
          <p className="mt-6 text-[12px] font-mono text-[#5d626c]">
            ~120 founders ahead of you · invite-only through Q3
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t hairline">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-[#d4ff3a]" />
            <span className="font-medium text-sm">BuybackAI</span>
            <span className="font-mono text-[11px] text-[#5d626c] ml-2">
              v0.1 · last shipped {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
          <p className="text-[12px] text-[#5d626c] text-center order-3 sm:order-2">
            Built on Dan Martell&apos;s Buy Back framework. Not affiliated with Dan Martell.
          </p>
          <div className="flex gap-6 text-[13px] text-[#5d626c] order-2 sm:order-3">
            <Link href="/privacy" className="hover:text-[#a1a6ae] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[#a1a6ae] transition-colors">Terms</Link>
            <a href="mailto:hello@buybackai.com" className="hover:text-[#a1a6ae] transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
