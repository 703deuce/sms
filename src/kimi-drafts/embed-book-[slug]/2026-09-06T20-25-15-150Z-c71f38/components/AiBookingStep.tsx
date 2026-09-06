"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Sparkles } from "lucide-react";
import { formatSlotDate, formatSlotTime, type BookingType, type Slot } from "../mock-data";

type Msg = { role: "ai" | "user"; text: string };

const SUGGESTED: Array<{ label: string; typeIdx: number; daysAhead: number; time: string }> = [
  { label: "Initial Consultation", typeIdx: 0, daysAhead: 2, time: "10:00" },
  { label: "Follow-Up Session", typeIdx: 1, daysAhead: 4, time: "14:00" },
  { label: "Deep Tissue Massage — 60 min", typeIdx: 2, daysAhead: 6, time: "15:30" },
];

export default function AiBookingStep({
  types,
  onSelectSlot,
  onManual,
}: {
  types: BookingType[];
  onSelectSlot: (type: BookingType, slot: Slot) => void;
  onManual: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "ai",
      text: "Hi! I can help you book in seconds. Tell me what you're looking for — for example, “a consultation next week” — or pick a service below.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: content }]);
    setLoading(true);
    // Sandbox: simulate /api/public/book/[slug]/ai
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: "Great — here are the soonest openings I found. Pick a service below and I'll hold the first available time for you to confirm with your details.",
        },
      ]);
      setLoading(false);
    }, 900);
  }

  function pickSuggestion(s: (typeof SUGGESTED)[number]) {
    const type = types[s.typeIdx];
    if (!type) return;
    const start = new Date();
    start.setDate(start.getDate() + s.daysAhead);
    const [h, m] = s.time.split(":").map(Number);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + type.durationMinutes * 60000);
    onSelectSlot(type, { startsAt: start.toISOString(), endsAt: end.toISOString() });
  }

  return (
    <div>
      <h1 className="eb-title">Book with AI assistance</h1>
      <p className="eb-sub">Describe what you need and I'll find a time that works.</p>
      <span className="eb-ai__badge">
        <Sparkles size={12} aria-hidden /> AI Booking — system confirms all times before booking
      </span>

      <div className="eb-ai">
        <div className="eb-ai__thread" ref={threadRef} aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`eb-msg eb-msg--${m.role}`}>
              {m.text}
            </div>
          ))}
          {loading ? <div className="eb-msg eb-msg--ai">…</div> : null}
          {messages.length > 1 ? (
            <div className="eb-ai__chips">
              {SUGGESTED.map((s) => {
                const d = new Date();
                d.setDate(d.getDate() + s.daysAhead);
                const [h, m] = s.time.split(":").map(Number);
                d.setHours(h, m);
                return (
                  <button
                    key={s.label}
                    type="button"
                    className="eb-ai__chip"
                    onClick={() => pickSuggestion(s)}
                  >
                    {s.label} ·{" "}
                    {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}{" "}
                    {s.time === "10:00" ? "10:00 AM" : s.time === "14:00" ? "2:00 PM" : "3:30 PM"}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="eb-ai__input">
          <input
            className="eb-input"
            placeholder="e.g. Massage Friday afternoon"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            aria-label="Message AI booking assistant"
          />
          <button
            type="button"
            className="eb-btn eb-btn--primary"
            onClick={() => send()}
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            <Send size={15} aria-hidden />
          </button>
        </div>
      </div>

      <div className="eb-actions">
        <button type="button" className="eb-btn eb-btn--ghost" onClick={onManual}>
          <ArrowLeft size={15} aria-hidden /> Book manually instead
        </button>
      </div>
    </div>
  );
}
