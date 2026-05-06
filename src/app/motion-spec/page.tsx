import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const metadata = {
  title: "Motion design spec — BuybackAI",
  description:
    "The motion design system for BuybackAI. Timing, easing, per-surface choreography, and accessibility — built in public.",
};

// Static content; rebuild whenever the file changes.
export const revalidate = 3600;

export default async function MotionSpecPage() {
  const filePath = path.join(process.cwd(), "docs", "MOTION-SPEC.md");
  const raw = await fs.readFile(filePath, "utf8");
  // Strip the H1 since we render our own header above the body.
  const body = raw.replace(/^#\s+.*\n+/, "").trim();

  return (
    <div className="min-h-screen bg-[#08090b] text-[#f7f8f8]">
      <nav className="sticky top-0 z-50 border-b hairline bg-[#08090b]/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-[#d4ff3a]" />
            <span className="font-medium tracking-tight text-[15px]">BuybackAI</span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-[#8a8f98]">
            <Link href="/agents" className="hover:text-[#f7f8f8] transition-colors">
              Agents
            </Link>
            <Link href="/pricing" className="hover:text-[#f7f8f8] transition-colors">
              Pricing
            </Link>
            <Link href="/motion-spec" className="text-[#f7f8f8]">
              Design
            </Link>
          </div>
        </div>
      </nav>

      <section className="border-b hairline">
        <div className="max-w-3xl mx-auto px-6 py-20 reveal">
          <p className="eyebrow mb-6">Design system · public</p>
          <h1 className="display text-4xl sm:text-5xl mb-6">
            How motion <span className="serif text-[#d4ff3a]">behaves here.</span>
          </h1>
          <p className="text-[16px] leading-[1.6] text-[#a1a6ae] max-w-2xl">
            BuybackAI sells "buying back time," so motion has to feel calm, deliberate, never
            frantic. This page is the source of truth — every component, easing curve, duration,
            and stagger value lives here. Built in public.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-[12px] font-mono">
            <a
              href="https://github.com/aidanmarketingagency-lang/buybackai/blob/master/docs/MOTION-SPEC.md"
              target="_blank"
              rel="noopener noreferrer"
              className="chip hover:text-[#f7f8f8] transition-colors"
            >
              VIEW ON GITHUB →
            </a>
            <Link href="/" className="chip hover:text-[#f7f8f8] transition-colors">
              ← BACK TO HOME
            </Link>
          </div>
        </div>
      </section>

      <article className="max-w-3xl mx-auto px-6 py-16 motion-spec reveal">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </article>

      <footer className="border-t hairline">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
          <Link href="/" className="text-[12px] text-[#5d626c] font-mono tracking-wider">
            ← BACK TO HOME
          </Link>
          <span className="text-[12px] text-[#5d626c] font-mono tracking-wider">
            v0.1 · last updated{" "}
            {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
      </footer>
    </div>
  );
}
