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

export async function POST(request: Request) {
  const requestApiKey = request.headers.get("x-gemini-api-key")?.trim();
  const apiKey = requestApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const modelName = process.env.GEMINI_MODEL ?? "gemini-1.5-flash-latest";

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing API key. Add GEMINI_API_KEY (or GOOGLE_API_KEY) on the server or save one in the UI settings panel.",
        code: "MISSING_API_KEY"
      },
      { status: 500 }
    );
  }

  let body: { persona?: PersonaKey; messages?: IncomingMessage[] };
  try {
    body = (await request.json()) as { persona?: PersonaKey; messages?: IncomingMessage[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "INVALID_BODY" }, { status: 400 });
  }

  const persona = body.persona && body.persona in personas ? body.persona : "Bestie";
  const messages = body.messages ?? [];

  if (!messages.length) {
    return NextResponse.json({ error: "No messages were provided." }, { status: 400 });
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      }
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Model request timed out. Please try again." }, { status: 504 });
    }
    return NextResponse.json({ error: "Network error while contacting model provider." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  let data: GeminiResponse;
  try {
    data = (await response.json()) as GeminiResponse;
  } catch {
    return NextResponse.json({ error: "Invalid response returned by model provider." }, { status: 502 });
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: data.error?.message ?? "Gemini request failed." },
      { status: response.status }
    );
  }

  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!reply) {
    return NextResponse.json({ error: "No reply returned by model." }, { status: 502 });
  }

  return NextResponse.json({ reply });
}
