"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Question {
  id: string;
  number: string;
  question: string;
  placeholder: string;
  hint?: string;
}

const QUESTIONS: Question[] = [
  {
    id: "role",
    number: "01",
    question: "What's your role?",
    placeholder: "Founder of a $2M SaaS · solo consultant · HVAC business owner...",
    hint: "Be specific. This shapes every reply your agents draft.",
  },
  {
    id: "company",
    number: "02",
    question: "Describe your business in one sentence.",
    placeholder: "A 6-person agency that builds websites for real estate agents...",
  },
  {
    id: "tone",
    number: "03",
    question: "How do you communicate?",
    placeholder: "Direct and casual. No fluff. I swear occasionally. I hate corporate-speak...",
    hint: "Your agents will match this in everything they write.",
  },
  {
    id: "priorities",
    number: "04",
    question: "Top three priorities right now.",
    placeholder: "1) Close 5 new clients this month  2) Ship the new feature by Friday  3) Stop doing ops...",
  },
  {
    id: "avoid",
    number: "05",
    question: "What should agents never do or say?",
    placeholder: "Never say 'circle back' or 'synergy'. Never send anything without my review. Never commit to deadlines...",
    hint: "Hard rules they always follow.",
  },
  {
    id: "context",
    number: "06",
    question: "Working context.",
    placeholder: "Pacific time. Short emails over long. Key contacts: Sarah (CFO), Mike (head of sales). Speed beats perfection...",
  },
  {
    id: "goals",
    number: "07",
    question: "What does winning look like in 90 days?",
    placeholder: "Hit $50K MRR. Hire my first ops person. Stop working weekends...",
  },
  {
    id: "metrics",
    number: "08",
    question: "What metrics matter?",
    placeholder: "MRR · customer churn · close rate · billable hours...",
  },
  {
    id: "tools",
    number: "09",
    question: "What tools does your business run on?",
    placeholder: "HubSpot for CRM · Slack · Notion · QuickBooks...",
  },
  {
    id: "signature",
    number: "10",
    question: "How do you sign off?",
    placeholder: "Just my first name. Or 'Best, [Name], [Title], [Company]'...",
  },
];

function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan");

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [masterPrompt, setMasterPrompt] = useState<string | null>(null);

  const question = QUESTIONS[currentStep];
  const isLast = currentStep === QUESTIONS.length - 1;

  function handleNext() {
    if (isLast) generateMasterPrompt();
    else setCurrentStep((s) => s + 1);
  }

  async function generateMasterPrompt() {
    setGenerating(true);
    try {
      const res = await fetch("/api/onboarding/master-prompt", {
        method: "POST",
        body: JSON.stringify({ answers }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      setMasterPrompt(data.masterPrompt);
    } catch {
      setMasterPrompt("Error generating prompt. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function finish() {
    await fetch("/api/onboarding/complete", {
      method: "POST",
      body: JSON.stringify({ masterPrompt }),
      headers: { "Content-Type": "application/json" },
    });
    router.push("/audit");
  }

  // ─── OUTPUT VIEW ─────────────────────────
  if (masterPrompt) {
    return (
      <div className="min-h-screen bg-[#08090b] text-[#f7f8f8] flex flex-col">
        <Nav />
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
          <div className="max-w-2xl w-full reveal">
            <p className="eyebrow mb-6">Master prompt · ready</p>
            <h1 className="display text-3xl sm:text-4xl mb-4">
              Your <span className="serif text-[#d4ff3a]">five-year colleague</span>, in one block.
            </h1>
            <p className="text-[15px] text-[#8a8f98] leading-[1.6] mb-8">
              This gets injected into every agent so they always know who you are, how you talk,
              and what you care about. You can edit it any time.
            </p>

            <div className="card mb-6">
              <div className="px-4 py-2.5 border-b hairline flex items-center justify-between">
                <span className="font-mono text-[11px] text-[#5d626c] tracking-wider">
                  MASTER_PROMPT.txt
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(masterPrompt)}
                  className="font-mono text-[11px] text-[#d4ff3a] hover:text-white transition-colors"
                >
                  copy
                </button>
              </div>
              <pre className="p-5 text-[13px] text-[#d4d8de] whitespace-pre-wrap leading-[1.7] font-mono max-h-72 overflow-y-auto m-0">
                {masterPrompt}
              </pre>
            </div>

            <p className="font-mono text-[11px] text-[#5d626c] mb-8 tracking-wider">
              EXPORTABLE · works in chatgpt · claude · cursor · anywhere
            </p>

            <button onClick={finish} className="btn btn-accent w-full justify-center">
              Continue to audit
              <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── GENERATING ─────────────────────────
  if (generating) {
    return (
      <div className="min-h-screen bg-[#08090b] text-[#f7f8f8] flex flex-col">
        <Nav />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center">
            <p className="font-mono text-[11px] text-[#d4ff3a] tracking-wider mb-4 pulse-soft">
              GENERATING ·····
            </p>
            <h2 className="serif text-3xl text-[#d4d8de] mb-3">
              Building your prompt.
            </h2>
            <p className="text-[14px] text-[#5d626c]">
              Compiling everything you told us into a context block your agents can read.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── QUESTION FLOW ──────────────────────
  return (
    <div className="min-h-screen bg-[#08090b] text-[#f7f8f8] flex flex-col">
      <Nav />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-xl w-full">
          {/* Progress */}
          <div className="flex items-center gap-3 mb-12">
            <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)] relative">
              <div
                className="absolute inset-y-0 left-0 bg-[#d4ff3a] transition-all duration-500"
                style={{ width: `${((currentStep + 1) / QUESTIONS.length) * 100}%`, height: "1px" }}
              />
            </div>
            <span className="font-mono text-[11px] text-[#5d626c] tracking-wider tabular shrink-0">
              {String(currentStep + 1).padStart(2, "0")} / {QUESTIONS.length}
            </span>
          </div>

          <div key={question.id} className="reveal">
            <p className="eyebrow mb-3">Master prompt · {question.number}</p>
            <h2 className="display text-3xl sm:text-4xl mb-3">{question.question}</h2>
            {question.hint && (
              <p className="text-[14px] text-[#5d626c] leading-[1.55] mb-6">{question.hint}</p>
            )}
            {!question.hint && <div className="mb-6" />}

            <textarea
              value={answers[question.id] || ""}
              onChange={(e) => setAnswers((p) => ({ ...p, [question.id]: e.target.value }))}
              placeholder={question.placeholder}
              rows={5}
              autoFocus
              className="w-full bg-transparent border-b hairline focus:border-[#d4ff3a] px-0 py-3 text-[16px] text-[#d4d8de] placeholder:text-[#3a3e46] outline-none transition-colors resize-none leading-[1.55]"
            />

            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                disabled={currentStep === 0}
                className="font-mono text-[12px] text-[#5d626c] hover:text-[#a1a6ae] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← back
              </button>
              <button
                onClick={handleNext}
                disabled={!answers[question.id]?.trim()}
                className="btn btn-accent disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isLast ? "Generate prompt" : "Next"}
                <span aria-hidden>→</span>
              </button>
            </div>
          </div>

          <p className="text-center font-mono text-[11px] text-[#5d626c] mt-12 tracking-wider">
            <button
              onClick={() => router.push("/audit")}
              className="hover:text-[#a1a6ae] transition-colors"
            >
              skip · go straight to audit
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function Nav() {
  return (
    <nav className="border-b hairline">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-[#d4ff3a]" />
          <span className="font-medium tracking-tight text-[15px]">BuybackAI</span>
        </Link>
        <Link href="/audit" className="text-sm text-[#8a8f98] hover:text-[#f7f8f8] transition-colors">
          Skip
        </Link>
      </div>
    </nav>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingForm />
    </Suspense>
  );
}
