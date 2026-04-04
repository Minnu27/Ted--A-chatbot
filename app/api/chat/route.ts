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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing GEMINI_API_KEY environment variable." },
      { status: 500 }
    );
  }

  const body = (await request.json()) as {
    persona?: PersonaKey;
    messages?: IncomingMessage[];
  };

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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  const data = (await response.json()) as GeminiResponse;

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
