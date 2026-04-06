"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { personaList, type PersonaKey } from "@/lib/personas";
import styles from "./chat.module.css";

type Message = {
  role: "user" | "assistant";
  content: string;
  mood?: "positive" | "neutral" | "negative";
};

type ChatResponse = {
  reply?: string;
  error?: string;
  code?: "MISSING_API_KEY" | "INVALID_BODY" | "REQUEST_FAILED";
};

const quickPrompts = [
  "Help me write a kind but confident text reply.",
  "Give me a 3-step action plan for today.",
  "Debug this code concept with simple examples.",
  "I feel overwhelmed. Help me reset in 5 minutes."
];

function detectMood(text: string): Message["mood"] {
  const positive = ["great", "happy", "excited", "love", "win", "good", "confident"];
  const negative = ["sad", "angry", "tired", "stuck", "anxious", "bad", "burnt out"];
  const lower = text.toLowerCase();
  if (positive.some((word) => lower.includes(word))) return "positive";
  if (negative.some((word) => lower.includes(word))) return "negative";
  return "neutral";
}

const API_KEY_STORAGE_KEY = "ted_user_api_key";

export default function Chat() {
  const [persona, setPersona] = useState<PersonaKey>("Bestie");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedKey = window.localStorage.getItem(API_KEY_STORAGE_KEY);
    if (storedKey) {
      setApiKey(storedKey);
    } else {
      setSettingsOpen(true);
      setStatusNote("Add your Gemini API key in Settings to start chatting.");
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const lastMood = useMemo(() => {
    const userMessages = messages.filter((m) => m.role === "user");
    return userMessages[userMessages.length - 1]?.mood ?? "neutral";
  }, [messages]);

  const conversationStats = useMemo(() => {
    const userMessages = messages.filter((m) => m.role === "user").length;
    const assistantMessages = messages.filter((m) => m.role === "assistant").length;
    return {
      userMessages,
      assistantMessages,
      total: messages.length
    };
  }, [messages]);

  function saveApiKey() {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      window.localStorage.removeItem(API_KEY_STORAGE_KEY);
      setStatusNote("API key removed from this browser.");
      return;
    }
    window.localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
    setStatusNote("API key saved in this browser. You can start chatting now.");
  }

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || loading) return;

    if (!apiKey.trim()) {
      setSettingsOpen(true);
      setStatusNote("Please enter a Gemini API key in Settings first.");
      return;
    }

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
        headers: {
          "Content-Type": "application/json",
          ...(apiKey.trim() ? { "x-gemini-api-key": apiKey.trim() } : {})
        },
        body: JSON.stringify({
          persona,
          messages: nextMessages
        })
      });

      const data = (await response.json()) as ChatResponse;
      if (!response.ok || !data.reply) {
        if (data.code === "MISSING_API_KEY") {
          setSettingsOpen(true);
        }
        throw new Error(data.error ?? "Something went wrong.");
      }

      const reply = data.reply;
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      setStatusNote("");
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

  function clearConversation() {
    if (loading) return;
    setMessages([]);
    setInput("");
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <div>
            <h1>Ted — My Wing Man</h1>
            <p>Advanced companion with persona switching, mood awareness, quick prompts, and API key settings.</p>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.ghostBtn} onClick={() => setSettingsOpen((prev) => !prev)}>
              {settingsOpen ? "Hide settings" : "Open settings"}
            </button>
            <button type="button" className={styles.ghostBtn} onClick={clearConversation} disabled={!messages.length || loading}>
              Clear chat
            </button>
          </div>
        </header>

        {statusNote && <div className={styles.statusNote}>{statusNote}</div>}

        {settingsOpen && (
          <section className={styles.settingsPanel}>
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

            <label className={styles.apiKeyWrap}>
              Gemini API Key (required)
              <div className={styles.apiKeyInputRow}>
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your key here (stored in browser localStorage)"
                />
                <button type="button" onClick={() => setShowApiKey((prev) => !prev)} className={styles.ghostBtn}>
                  {showApiKey ? "Hide" : "Show"}
                </button>
                <button type="button" onClick={saveApiKey} className={styles.primaryBtn}>
                  Save key
                </button>
              </div>
            </label>
          </section>
        )}

        <div className={styles.metricsGrid}>
          <article>
            <span>Total Messages</span>
            <strong>{conversationStats.total}</strong>
          </article>
          <article>
            <span>You</span>
            <strong>{conversationStats.userMessages}</strong>
          </article>
          <article>
            <span>Ted</span>
            <strong>{conversationStats.assistantMessages}</strong>
          </article>
          <article className={styles.moodCard} data-mood={lastMood}>
            <span>Mood Signal</span>
            <strong>{lastMood}</strong>
          </article>
        </div>

        <div className={styles.quickPrompts}>
          {quickPrompts.map((prompt) => (
            <button key={prompt} onClick={() => sendMessage(prompt)} type="button" disabled={loading}>
              {prompt}
            </button>
          ))}
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
          {loading && <div className={styles.typing}>Ted is thinking…</div>}
          <div ref={chatEndRef} />
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
          <button type="submit" disabled={loading} className={styles.primaryBtn}>
            {loading ? "Thinking..." : "Send"}
          </button>
        </form>
      </section>
    </main>
  );
}
