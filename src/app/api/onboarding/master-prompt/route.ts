import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { answers } = await request.json();

  const prompt = `You are creating a "Master Prompt" — a reusable context block that gives an AI assistant the equivalent of 5 years of working alongside this person.

Based on these answers from the user, write a comprehensive, first-person Master Prompt they can use to give any AI instant context about who they are and how to work with them effectively.

USER ANSWERS:
Role: ${answers.role || "Not provided"}
Business: ${answers.company || "Not provided"}
Tone/Communication style: ${answers.tone || "Not provided"}
Top 3 priorities: ${answers.priorities || "Not provided"}
What to avoid: ${answers.avoid || "Not provided"}
Working context: ${answers.context || "Not provided"}
90-day goals: ${answers.goals || "Not provided"}
Key metrics: ${answers.metrics || "Not provided"}
Tools used: ${answers.tools || "Not provided"}
Email signature style: ${answers.signature || "Not provided"}

Write the Master Prompt in second person addressed to the AI ("You are working with...") or as a context block. Make it:
- Concrete and specific (not generic)
- Between 200-400 words
- Structured with clear sections
- Ready to paste into any AI tool
- In a tone that matches how they described themselves

Do not include any preamble. Start directly with the Master Prompt content.`;

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") return NextResponse.json({ error: "Generation failed" }, { status: 500 });

  return NextResponse.json({ masterPrompt: content.text });
}
