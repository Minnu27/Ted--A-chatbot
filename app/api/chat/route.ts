import { NextResponse } from "next/server";
import { personas, type PersonaKey } from "@/lib/personas";

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
};

type GeminiCandidate = {
  content?: {
    parts?: Array<{ text?: string }>;
  };
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
  error?: {
    message?: string;
  };
};

type GeminiAttemptResult = {
  response: Response;
  data: GeminiResponse;
  model: string;
  version: string;
};

function getPersonaPrefix(persona: PersonaKey): string {
  const personaPrefix: Record<PersonaKey, string> = {
    Bestie: "Bestie mode 💛",
    Guardian: "Guardian mode 🛡️",
    Cheerleader: "Cheerleader mode 🎉",
    Sage: "Sage mode 🌿",
    Realist: "Realist mode 🧭",
    Coder: "Coder mode 💻"
  };

  return personaPrefix[persona];
}

function buildFinanceFallback(persona: PersonaKey, message: string): string {
  const intro: Record<PersonaKey, string> = {
    Bestie: "That sounds stressful, and you're doing the right thing by asking.",
    Guardian: "Let's reduce risk first, then decide your next move.",
    Cheerleader: "Good call asking early — we can absolutely make a plan.",
    Sage: "Take a breath. We'll turn uncertainty into clear steps.",
    Realist: "Here's the practical playbook.",
    Coder: "Let's debug this like a system: inputs, constraints, output."
  };

  return `${getPersonaPrefix(persona)}: ${intro[persona]}\n\n1) Protect downside today: pause any new risky money moves for 24 hours.\n2) Snapshot your numbers: cash on hand, monthly expenses, debts (rate + EMI), and upcoming dues.\n3) Pick your priority: (a) stop losses, (b) reduce debt pressure, or (c) stabilize income.\n4) Send me these 4 details and I'll give you a concrete step-by-step plan:\n   • monthly income\n   • essential expenses\n   • total debt + interest rates\n   • urgent deadline (if any)\n\nFrom your message: "${message}"`; 
}

function buildCodingFallback(persona: PersonaKey, message: string): string {
  const intro: Record<PersonaKey, string> = {
    Bestie: "Nice — let's solve it together.",
    Guardian: "We'll do this safely and systematically.",
    Cheerleader: "Perfect, let's get that bug crushed 🎯",
    Sage: "We'll simplify the problem until it becomes solvable.",
    Realist: "Fastest path to fix:",
    Coder: "Great, let's troubleshoot properly."
  };

  return `${getPersonaPrefix(persona)}: ${intro[persona]}\n\nShare these and I’ll respond with a precise fix:\n1) Exact error text\n2) File/snippet (20-40 lines)\n3) What you expected vs what happened\n4) What you already tried`; 
}

function buildGeneralFallback(persona: PersonaKey, message: string): string {
  const voice: Record<PersonaKey, string> = {
    Bestie: "I'm with you — let's handle this one step at a time.",
    Guardian: "Let's keep this clear and safe.",
    Cheerleader: "You've got momentum — let's use it.",
    Sage: "Let's find the calm, effective next step.",
    Realist: "Straight answer:",
    Coder: "Let's structure this problem and solve it."
  };

  const nextStepByPersona: Record<PersonaKey, string> = {
    Bestie: "Tell me your goal + what's blocking you most right now.",
    Guardian: "Tell me the risk, timeline, and the decision you must make.",
    Cheerleader: "Tell me your target and your next 15-minute action.",
    Sage: "Tell me what outcome matters most and what feels hardest.",
    Realist: "Give me facts: goal, constraint, and deadline.",
    Coder: "Provide inputs, expected output, and current output."
  };

  return `${getPersonaPrefix(persona)}: ${voice[persona]}\n\nYou said: "${message}"\n\n${nextStepByPersona[persona]}`;
}

function buildLocalFallbackReply(persona: PersonaKey, latestUserMessage: string): string {
  const safeMessage = latestUserMessage.trim();

  if (!safeMessage) {
    return `${getPersonaPrefix(persona)}: I'm in local fallback mode, but I can still help. Tell me your situation in one or two lines.`;
  }

  if (/^(hi|hello|hey|yo|sup|good\s?(morning|afternoon|evening))\b/i.test(safeMessage)) {
    const greetingByPersona: Record<PersonaKey, string> = {
      Bestie: "Hey 💛 I'm here with you. What do you want help with right now?",
      Guardian: "Hey there. Tell me the situation and I'll help you decide safely.",
      Cheerleader: "Hey! 🎉 Tell me your goal and let's make a quick win.",
      Sage: "Hello 🌿 What's weighing on you today?",
      Realist: "Hi. Share the situation in one line, and I'll give you a direct plan.",
      Coder: "Hey 💻 Share the bug/problem and I'll help you solve it quickly."
    };
    return `${getPersonaPrefix(persona)}: ${greetingByPersona[persona]}`;
  }

  const lower = safeMessage.toLowerCase();
  if (/(finance|money|debt|loan|salary|investment|loss|trading|stock|emi|credit card)/i.test(lower)) {
    return buildFinanceFallback(persona, safeMessage);
  }

  if (/(code|bug|error|python|javascript|react|next\.js|api|compile|stack trace)/i.test(lower)) {
    return buildCodingFallback(persona, safeMessage);
  }

  return buildGeneralFallback(persona, safeMessage);
}

function isModelNotFound(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("not found") || lower.includes("not supported for generatecontent");
}

async function callGemini(
  apiKey: string,
  model: string,
  version: string,
  payload: object,
  signal: AbortSignal
): Promise<GeminiAttemptResult> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal
    }
  );

  const data = (await response.json()) as GeminiResponse;
  return { response, data, model, version };
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const configuredModel = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const configuredVersion = process.env.GEMINI_API_VERSION ?? "v1";

  let body: { persona?: PersonaKey; messages?: IncomingMessage[] };
  try {
    body = (await request.json()) as { persona?: PersonaKey; messages?: IncomingMessage[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const persona = body.persona && body.persona in personas ? body.persona : "Bestie";
  const messages = body.messages ?? [];

  if (!messages.length) {
    return NextResponse.json({ error: "No messages were provided." }, { status: 400 });
  }

  if (!apiKey) {
    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
    const reply = buildLocalFallbackReply(persona, latestUserMessage);
    return NextResponse.json({ reply, mode: "local-fallback" });
  }

  const contents = messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }]
  }));

  const payload = {
    system_instruction: {
      parts: [{ text: personas[persona] }]
    },
    contents,
    generationConfig: {
      temperature: 0.8,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 600
    }
  };

  const candidateModels = [configuredModel, configuredModel.replace(/-latest$/i, ""), "gemini-1.5-flash"];
  const candidateVersions = [configuredVersion, "v1", "v1beta"];

  const attempts: Array<{ model: string; version: string }> = [];
  for (const version of candidateVersions) {
    for (const model of candidateModels) {
      const key = `${version}::${model}`;
      if (!attempts.some((a) => `${a.version}::${a.model}` === key)) {
        attempts.push({ version, model });
      }
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  let lastAttempt: GeminiAttemptResult | null = null;

  try {
    for (const attempt of attempts) {
      const result = await callGemini(apiKey, attempt.model, attempt.version, payload, controller.signal);
      lastAttempt = result;

      if (result.response.ok) {
        const reply = result.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!reply) {
          return NextResponse.json({ error: "No reply returned by model." }, { status: 502 });
        }
        return NextResponse.json({ reply });
      }

      const providerError = result.data.error?.message ?? "Gemini request failed.";
      if (isModelNotFound(providerError)) {
        continue;
      }

      return NextResponse.json({ error: providerError }, { status: result.response.status });
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Model request timed out. Please try again." }, { status: 504 });
    }
    return NextResponse.json({ error: "Network error while contacting model provider." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  const fallbackError = lastAttempt?.data.error?.message ?? "Gemini request failed.";
  return NextResponse.json(
    {
      error:
        `None of the attempted model/version combinations worked (${attempts.map((a) => `${a.model}@${a.version}`).join(", ")}). Last provider error: ${fallbackError}`
    },
    { status: 400 }
  );
}
