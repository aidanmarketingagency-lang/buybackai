import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import UpgradeButton from "@/components/UpgradeButton";
import BillingPortalButton from "@/components/BillingPortalButton";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";

export const metadata = {
  title: "Pricing — BuybackAI",
  description: "Hire AI agents to take $20/hr work off your plate. Free audit, paid agents.",
};

interface Tier {
  id: "free" | "pro" | "founder";
  name: string;
  price: string;
  unit: string;
  tagline: string;
  bullets: string[];
  cta: string;
  highlight?: boolean;
}

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    unit: "forever",
    tagline: "Run the audit. Hire one agent. See if it earns its keep.",
    bullets: [
      "1 active agent",
      "Free 2-min audit, anytime",
      "Email triage by Inbox Ivy",
      "Read-only Gmail + Calendar",
    ],
    cta: "Start free",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49",
    unit: "/month",
    tagline: "All three agents working full-time. The point at which you stop noticing them.",
    bullets: [
      "Up to 5 active agents",
      "Inbox Ivy · Meeting Marv · Follow-up Fred",
      "Hourly meeting briefs",
      "6-hourly follow-up sweeps",
      "Priority email support",
    ],
    cta: "Upgrade to Pro",
    highlight: true,
  },
  {
    id: "founder",
    name: "Founder",
    price: "$149",
    unit: "/month",
    tagline: "For the founder running multiple plates. Unlimited agents, custom master prompts.",
    bullets: [
      "Unlimited agents",
      "Everything in Pro",
      "Custom agent requests",
      "Direct line to the founder (Aidan)",
      "Quarterly buyback strategy call",
    ],
    cta: "Go Founder",
  },
];

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentPlan: "free" | "pro" | "founder" = "free";
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    currentPlan = (data?.plan as "free" | "pro" | "founder") ?? "free";
  }

  return (
    <div className="min-h-screen bg-[#08090b] text-[#f7f8f8]">
      <nav className="sticky top-0 z-50 border-b hairline bg-[#08090b]/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-[#d4ff3a]" />
            <span className="font-medium tracking-tight text-[15px]">BuybackAI</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/agents" className="text-sm text-[#8a8f98] hover:text-[#f7f8f8] transition-colors">
              Agents
            </Link>
            <Link href="/pricing" className="text-sm text-[#f7f8f8]">
              Pricing
            </Link>
            {user ? (
              <Link href="/dashboard" className="btn btn-ghost">
                Dashboard
              </Link>
            ) : (
              <Link href="/auth/signup" className="btn btn-accent">
                Start free
              </Link>
            )}
          </div>
        </div>
      </nav>

      <section className="border-b hairline">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center reveal">
          <p className="eyebrow mb-6">Pricing</p>
          <h1 className="display text-4xl sm:text-5xl lg:text-6xl mb-6">
            Pay for the hours back,
            <br />
            <span className="serif text-[#d4ff3a]">not the software.</span>
          </h1>
          <p className="text-[16px] leading-[1.55] text-[#a1a6ae] max-w-xl mx-auto">
            Free audit, free first agent. When the time you get back is worth more than dinner,
            upgrade.
          </p>
        </div>
      </section>

      <section>
        <Stagger
          speed="slow"
          className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-px bg-[rgba(255,255,255,0.06)] border hairline"
        >
          {TIERS.map((tier) => {
            const isCurrent = currentPlan === tier.id;
            return (
              <StaggerItem
                key={tier.id}
                className={`bg-[#08090b] p-8 flex flex-col ${
                  tier.highlight ? "lg:scale-[1.02]" : ""
                }`}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <p className="eyebrow">{tier.name}</p>
                  {tier.highlight && (
                    <span className="font-mono text-[11px] text-[#d4ff3a] tracking-wider">
                      MOST POPULAR
                    </span>
                  )}
                  {isCurrent && (
                    <span className="font-mono text-[11px] text-[#d4ff3a] tracking-wider">
                      YOUR PLAN
                    </span>
                  )}
                </div>
                <div className="mb-2 flex items-baseline gap-1">
                  <span className="display text-4xl tabular">{tier.price}</span>
                  <span className="text-[#5d626c] text-[13px]">{tier.unit}</span>
                </div>
                <p className="text-[14px] leading-[1.55] text-[#a1a6ae] mb-6 min-h-[3.4em]">
                  {tier.tagline}
                </p>
                <ul className="space-y-2 mb-8 flex-1">
                  {tier.bullets.map((b) => (
                    <li
                      key={b}
                      className="text-[13px] text-[#d4d8de] flex items-start gap-2 leading-[1.55]"
                    >
                      <span className="text-[#d4ff3a] mt-0.5 shrink-0">→</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <PricingCta
                  tier={tier}
                  isCurrent={isCurrent}
                  signedIn={!!user}
                />
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>

      <section className="border-t hairline">
        <Reveal className="max-w-3xl mx-auto px-6 py-20">
          <p className="eyebrow mb-6">Common questions</p>
          <div className="space-y-8">
            {[
              {
                q: "Why charge per plan, not per agent?",
                a: "Founders rarely buy back one chunk of time at a time. The minute Inbox Ivy works, you want Marv. Tier pricing keeps the math simple — and means I can ship new agents without renegotiating with anyone.",
              },
              {
                q: "Can I cancel any time?",
                a: "Yes. Click manage billing in the dashboard, hit cancel. Access continues to the end of the billing period, then drops to free. Your audit history stays.",
              },
              {
                q: "Is the audit really free?",
                a: "Yes. The audit is free forever, no card. We run it because the dollar number is what makes you understand your week. Even if you never pay, that number was useful.",
              },
              {
                q: "Will you train models on my email?",
                a: "No. Your data is yours. We pass individual emails through Anthropic's API for triage; we don't store training corpora. Read-only Gmail and Calendar; nothing is sent without you approving each draft.",
              },
              {
                q: "What if I want a custom agent?",
                a: "That's what Founder is for. Tell me what's eating your week and I'll build it as the next agent in the marketplace.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="border-t hairline pt-6">
                <p className="text-[15px] font-medium mb-2">{q}</p>
                <p className="text-[14px] text-[#a1a6ae] leading-[1.6]">{a}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <footer className="border-t hairline">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
          <Link href="/" className="text-[12px] text-[#5d626c] font-mono tracking-wider">
            ← BACK TO HOME
          </Link>
          {user && (
            <BillingPortalButton className="text-[12px] text-[#5d626c] font-mono tracking-wider hover:text-[#a1a6ae] transition-colors">
              MANAGE BILLING →
            </BillingPortalButton>
          )}
        </div>
      </footer>
    </div>
  );
}

function PricingCta({
  tier,
  isCurrent,
  signedIn,
}: {
  tier: Tier;
  isCurrent: boolean;
  signedIn: boolean;
}) {
  if (isCurrent) {
    if (tier.id === "free") {
      return (
        <Link href="/dashboard" className="btn btn-ghost justify-center">
          Open dashboard
        </Link>
      );
    }
    return (
      <BillingPortalButton className="btn btn-ghost justify-center w-full">
        Manage billing
      </BillingPortalButton>
    );
  }

  if (tier.id === "free") {
    if (signedIn) {
      return (
        <Link href="/dashboard" className="btn btn-ghost justify-center">
          Continue free
        </Link>
      );
    }
    return (
      <Link href="/auth/signup" className="btn btn-ghost justify-center">
        {tier.cta}
      </Link>
    );
  }

  if (!signedIn) {
    return (
      <Link
        href={`/auth/signup?next=/pricing`}
        className={tier.highlight ? "btn btn-accent justify-center" : "btn btn-ghost justify-center"}
      >
        {tier.cta}
      </Link>
    );
  }

  return (
    <UpgradeButton
      plan={tier.id as "pro" | "founder"}
      className={
        tier.highlight
          ? "btn btn-accent justify-center w-full"
          : "btn btn-ghost justify-center w-full"
      }
    >
      {tier.cta}
    </UpgradeButton>
  );
}
