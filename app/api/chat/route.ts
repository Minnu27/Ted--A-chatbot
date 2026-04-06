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
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const modelName = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const apiVersion = process.env.GEMINI_API_VERSION ?? "v1";

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Missing API key. Add GEMINI_API_KEY (or GOOGLE_API_KEY) in .env.local and restart the server."
      },
      { status: 500 }
    );
  }

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
      `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`,
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
    const providerError = data.error?.message ?? "Gemini request failed.";
    if (providerError.toLowerCase().includes("not found")) {
      return NextResponse.json(
        {
          error:
            `Model \"${modelName}\" was not found for API version \"${apiVersion}\". Set GEMINI_MODEL in .env.local to a supported model.`
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: providerError }, { status: response.status });
  }

  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!reply) {
    return NextResponse.json({ error: "No reply returned by model." }, { status: 502 });
  }

  return NextResponse.json({ reply });
}
