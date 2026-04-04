"use client";

import { useMemo, useState } from "react";
import { personaList, type PersonaKey } from "@/lib/personas";
import styles from "./chat.module.css";

type Message = {
  role: "user" | "assistant";
  content: string;
  mood?: "positive" | "neutral" | "negative";
};

const quickPrompts = [
  "Help me write a kind but confident text reply.",
  "Give me a 3-step action plan for today.",
  "Debug this code concept with simple examples.",
  "I feel overwhelmed. Help me reset in 5 minutes."
];

function detectMood(text: string): Message["mood"] {
  const positive = ["great", "happy", "excited", "love", "win", "good"];
  const negative = ["sad", "angry", "tired", "stuck", "anxious", "bad"];
  const lower = text.toLowerCase();
  if (positive.some((word) => lower.includes(word))) return "positive";
  if (negative.some((word) => lower.includes(word))) return "negative";
  return "neutral";
}

export default function Chat() {
  const [persona, setPersona] = useState<PersonaKey>("Bestie");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const lastMood = useMemo(() => {
    const userMessages = messages.filter((m) => m.role === "user");
    return userMessages[userMessages.length - 1]?.mood ?? "neutral";
  }, [messages]);

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = {
      role: "user",
      content: trimmed,
      mood: detectMood(trimmed)
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona,
          messages: nextMessages
        })
      });

      const data = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !data.reply) {
        throw new Error(data.error ?? "Something went wrong.");
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? `⚠️ ${error.message}`
              : "⚠️ I hit a snag while generating a reply."
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <div>
            <h1>Ted — My Wing Man</h1>
            <p>Adaptive AI companion with personality switching, quick prompts, and mood-aware UI.</p>
          </div>
          <label className={styles.personaWrap}>
            Persona
            <select value={persona} onChange={(e) => setPersona(e.target.value as PersonaKey)}>
              {personaList.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </header>

        <div className={styles.quickPrompts}>
          {quickPrompts.map((prompt) => (
            <button key={prompt} onClick={() => sendMessage(prompt)} type="button" disabled={loading}>
              {prompt}
            </button>
          ))}
        </div>

        <div className={styles.moodBadge} data-mood={lastMood}>
          Current mood signal: <strong>{lastMood}</strong>
        </div>

        <div className={styles.chatArea}>
          {messages.length === 0 && (
            <div className={styles.empty}>Start a conversation or tap a quick prompt to begin.</div>
          )}

          {messages.map((message, index) => (
            <article key={`${message.role}-${index}`} className={`${styles.message} ${styles[message.role]}`}>
              <span>{message.role === "user" ? "You" : "Ted"}</span>
              <p>{message.content}</p>
            </article>
          ))}
        </div>

        <form
          className={styles.inputRow}
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell Ted what you need..."
          />
          <button type="submit" disabled={loading}>
            {loading ? "Thinking..." : "Send"}
          </button>
        </form>
      </section>
    </main>
  );
}
