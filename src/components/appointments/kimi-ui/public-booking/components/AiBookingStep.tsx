"use client";

import { useEffect, useRef, useState } from "react";
import { aiInitialMessages, aiSuggestions, bookingTypes, workspace } from "../mock-data";
import { ArrowLeft, CalendarCheck, Send, Sparkles } from "lucide-react";

type Msg = { role: "assistant" | "user"; text: string; slots?: string[] };

const cannedSlots = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return ["09:30", "13:00", "15:30"].map((t) => {
    const [h, m] = t.split(":").map(Number);
    const s = new Date(d);
    s.setHours(h, m, 0, 0);
    return s.toISOString();
  });
})();

export function AiBookingStep({
  onBack,
  onSelectSlot,
}: {
  onBack: () => void;
  onSelectSlot: (typeId: string, startsAt: string) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>(aiInitialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setLoading(true);
    // POST /api/public/book/{slug}/ai
    await new Promise((r) => setTimeout(r, 1100));
    const lower = trimmed.toLowerCase();
    const type =
      bookingTypes.find((t) => lower.includes("clean")) ||
      bookingTypes.find((t) => lower.includes("whiten")) ||
      bookingTypes.find((t) => lower.includes("align")) ||
      bookingTypes[0];
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        text: `I can help with that. The ${type.name} is ${type.durationMinutes} minutes with ${workspace.name}. Here are the next available times — pick one and I'll finish the booking with you:`,
        slots: cannedSlots,
      },
    ]);
    setLoading(false);
  }

  return (
    <div className="tv-fade-up mx-auto max-w-2xl">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to services
      </button>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b border-border px-5 py-3.5" style={{ background: "linear-gradient(135deg, rgba(67,56,202,0.07), transparent)" }}>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4.5 w-4.5" />
          </span>
          <div>
            <h1 className="font-display text-[15px] font-semibold text-foreground">AI booking assistant</h1>
            <p className="text-[12px] text-muted-foreground">Tell me what you need — I'll find a time and book it.</p>
          </div>
        </div>

        <div className="tv-slot-scroll h-[380px] space-y-4 overflow-y-auto px-5 py-5" aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`tv-bubble-in flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                  m.role === "user"
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md bg-muted text-foreground"
                }`}
              >
                {m.text}
                {m.slots ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.slots.map((iso) => {
                      const d = new Date(iso);
                      const label = d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
                      return (
                        <button
                          key={iso}
                          onClick={() => onSelectSlot(bookingTypes[0].id, iso)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-card px-3 py-2 text-[12px] font-semibold text-primary shadow-sm transition-colors hover:bg-accent"
                        >
                          <CalendarCheck className="h-3.5 w-3.5" /> {label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {loading ? (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted px-4 py-3 text-[13px] text-muted-foreground">
                <span className="tv-spinner" style={{ width: 14, height: 14 }} /> Checking availability…
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {messages.length === 1 ? (
          <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
            {aiSuggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
            placeholder="Type your message…"
            aria-label="Message the booking assistant"
            className="h-10 flex-1 rounded-lg border border-border bg-card px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-primary-foreground shadow-sm transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
            style={{ background: "var(--primary)" }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Availability is always confirmed by {workspace.name}'s live schedule before anything is booked.
      </p>
    </div>
  );
}
