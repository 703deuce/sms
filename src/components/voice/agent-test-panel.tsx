"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; text: string };

/**
 * In-app test conversation before deploy.
 * Uses Telnyx assistant chat after Build, plus browser speech + TTS when available.
 */
export function AgentTestPanel({
  agentId,
  telnyxAssistantId,
  voiceId,
  language,
  status,
}: {
  agentId: string;
  telnyxAssistantId?: string | null;
  voiceId?: string;
  language?: string;
  status?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("Hi — what can you help me with?");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const ready = Boolean(telnyxAssistantId);

  useEffect(() => {
    return () => {
      try {
        (window as unknown as { webkitSpeechRecognition?: { stop: () => void } })
          .webkitSpeechRecognition?.stop?.();
      } catch {
        // ignore
      }
    };
  }, []);

  async function speak(text: string) {
    try {
      const res = await fetch("/api/voice/tts-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: text.slice(0, 500),
          voice: voiceId || "Telnyx.NaturalHD.andromeda",
          language: language || "en-US",
        }),
      });
      const j = await res.json();
      const url = j.data?.audioUrl;
      if (url && audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play().catch(() => undefined);
        return;
      }
    } catch {
      // fall through to browser TTS
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = language || "en-US";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError("");
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setInput("");
    try {
      const res = await fetch("/api/voice/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "chat_preview",
          agentId,
          message,
          conversationId: conversationId || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Chat failed");
      const data = j.data;
      if (data?.conversation_id || data?.id) {
        setConversationId(String(data.conversation_id || data.id));
      }
      const reply =
        typeof data === "string"
          ? data
          : data?.reply ||
            data?.message ||
            data?.choices?.[0]?.message?.content ||
            data?.messages?.slice?.(-1)?.[0]?.content ||
            (typeof data?.data === "string" ? data.data : null) ||
            JSON.stringify(data);
      const textReply = String(reply);
      setMessages((prev) => [...prev, { role: "assistant", text: textReply }]);
      await speak(textReply);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function startListening() {
    const SR =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition })
        .webkitSpeechRecognition;
    if (!SR) {
      setError("Browser speech recognition not available — type to chat instead.");
      return;
    }
    const rec = new SR();
    rec.lang = language || "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setListening(true);
    setError("");
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      const transcript = ev.results?.[0]?.[0]?.transcript || "";
      setListening(false);
      if (transcript) void send(transcript);
    };
    rec.onerror = () => {
      setListening(false);
      setError("Could not hear you — try again or type.");
    };
    rec.onend = () => setListening(false);
    rec.start();
  }

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <CardTitle>Test conversation</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Build the agent first, then talk here before deploying to a number.
            {!ready
              ? " Click “Build & test” above to sync the assistant to Telnyx."
              : status === "TESTING"
                ? " Testing build — chat or use your mic, then Deploy to number when ready."
                : status === "ACTIVE"
                  ? " Live agent — you can still preview chat here."
                  : " Ready — chat or use your mic."}
          </p>
        </div>
        <audio ref={audioRef} className="hidden" />
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto rounded border border-border bg-muted/20 p-3 text-sm">
        {messages.length === 0 ? (
          <p className="text-muted-foreground">No messages yet.</p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-8 rounded-lg bg-background px-3 py-2"
                  : "mr-8 rounded-lg bg-muted px-3 py-2"
              }
            >
              <span className="text-[10px] uppercase text-muted-foreground">{m.role}</span>
              <p>{m.text}</p>
            </div>
          ))
        )}
      </div>

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}

      <Textarea
        rows={2}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send(input);
          }
        }}
        placeholder="Type a message…"
        disabled={busy || !ready}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || !ready || !input.trim()} onClick={() => void send(input)}>
          {busy ? "Thinking…" : "Send"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !ready || listening}
          onClick={startListening}
        >
          {listening ? "Listening…" : "Talk (mic)"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!messages.length}
          onClick={() => {
            setMessages([]);
            setConversationId(null);
          }}
        >
          Clear
        </Button>
      </div>
    </Card>
  );
}

// Minimal speech types for browsers that expose webkit prefix.
type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionEvent = {
  results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
};
