"use client";

import { useState } from "react";

type Message = { role: "user" | "assistant"; text: string };

const SUGGESTIONS = [
  "Who owes me the most?",
  "Which products are running low?",
  "How did my business perform this month?",
  "Why did my expenses increase?",
];

export function CopilotChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      const text = res.ok ? data.answer : `⚠️ ${data.error ?? "Something went wrong."}`;
      setMessages((prev) => [...prev, { role: "assistant", text }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "⚠️ Could not reach the copilot." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col h-[28rem]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Try asking:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="block w-full text-left text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm px-3 py-2 rounded-lg max-w-[85%] whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-brand-600 text-white ml-auto"
                : "bg-gray-100 text-gray-900"
            }`}
          >
            {m.text}
          </div>
        ))}
        {loading && <div className="text-sm text-gray-400">Thinking…</div>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="border-t border-gray-100 p-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your business…"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 text-white text-sm font-medium px-4 py-2 hover:bg-brand-700 disabled:opacity-60"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
