"use client";

import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";

function speakGreeting(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.96;
  window.speechSynthesis.speak(utterance);
}

export function DashboardWelcome({ businessName }: { businessName: string }) {
  const [timeGreeting, setTimeGreeting] = useState("Good day");
  const greeting = `${timeGreeting}, ${businessName}. Welcome to GTK BusinessOS. Here's what's happening today.`;

  useEffect(() => {
    const hour = new Date().getHours();
    const localGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    setTimeGreeting(localGreeting);
    speakGreeting(`${localGreeting}, ${businessName}. Welcome to GTK BusinessOS. Here's what's happening today.`);
    return () => window.speechSynthesis?.cancel();
  }, [businessName]);

  return (
    <div className="flex items-start gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{timeGreeting}, {businessName}</h1>
        <p className="text-sm text-gray-500">Here&apos;s what&apos;s happening today.</p>
      </div>
      <button
        type="button"
        onClick={() => speakGreeting(greeting)}
        aria-label="Replay spoken greeting"
        title="Replay greeting"
        className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 hover:text-green-700 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
      >
        <Volume2 size={17} aria-hidden="true" />
      </button>
    </div>
  );
}