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

function buildLocalFallbackReply(persona: PersonaKey, latestUserMessage: string): string {
  const personaPrefix: Record<PersonaKey, string> = {
    Bestie: "Bestie mode 💛",
    Guardian: "Guardian mode 🛡️",
    Cheerleader: "Cheerleader mode 🎉",
    Sage: "Sage mode 🌿",
    Realist: "Realist mode 🧭",
    Coder: "Coder mode 💻"
  };

  const safeMessage = latestUserMessage.trim() || "your message";

  return `${personaPrefix[persona]}: I can still chat right now in local fallback mode. Here's a quick response to "${safeMessage}":\n\n1) Clarify your goal in one sentence.\n2) Pick one small next step you can do in 10 minutes.\n3) Send me what you tried, and I'll refine the next step.`;
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
        `None of the attempted model/version combinations worked (${attempts.map((a) => `${a.model}@${a.version}`).join(", " )}). Last provider error: ${fallbackError}`
    },
    { status: 400 }
  );
}
