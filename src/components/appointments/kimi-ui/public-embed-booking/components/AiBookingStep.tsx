"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, Send, Sparkles } from "lucide-react";
import { formatSlotDate, formatSlotTime, type BookingType, type Slot } from "../mock-data";

type AiMessage = { role: "user" | "assistant"; content: string };

const GREETING =
  "Hi! I can help you book in seconds. Tell me what you're looking for — for example, “a consultation next week” — and I'll find real openings from the live schedule.";

export default function AiBookingStep({
  types,
  selectedType,
  workspaceName,
  timezone,
  messages,
  input,
  onInputChange,
  onSend,
  loading,
  error,
  slots,
  onSelectSlot,
  onManual,
}: {
  types: BookingType[];
  selectedType?: BookingType | null;
  workspaceName?: string;
  timezone?: string;
  messages: AiMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void | Promise<void>;
  loading: boolean;
  error?: string;
  slots: Slot[];
  onSelectSlot: (type: BookingType, slot: Slot) => void;
  onManual: () => void;
}) {
  const displayMessages = messages.length > 0 ? messages : [{ role: "assistant" as const, content: GREETING }];
  const threadRef = useRef<HTMLDivElement>(null);
  const slotType = selectedType || types[0];

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [displayMessages, loading, slots]);

  async function send() {
    const content = input.trim();
    if (!content || loading) return;
    await onSend();
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
          {displayMessages.map((m, i) => (
            <div key={i} className={`eb-msg eb-msg--${m.role === "user" ? "user" : "ai"}`}>
              {m.content}
            </div>
          ))}

          {slots.length > 0 && slotType ? (
            <div className="eb-ai__chips">
              {slots.map((slot) => (
                <button
                  key={slot.startsAt}
                  type="button"
                  className="eb-ai__chip"
                  onClick={() => onSelectSlot(slotType, slot)}
                >
                  {formatSlotDate(slot.startsAt)} · {formatSlotTime(slot.startsAt)}
                </button>
              ))}
            </div>
          ) : null}

          {loading ? <div className="eb-msg eb-msg--ai">…</div> : null}
        </div>

        {error ? (
          <p className="eb-sub" style={{ color: "var(--destructive)", marginTop: 8 }} role="alert">
            {error}
          </p>
        ) : null}

        <div className="eb-ai__input">
          <input
            className="eb-input"
            placeholder="e.g. Massage Friday afternoon"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
            aria-label="Message AI booking assistant"
            disabled={loading}
          />
          <button
            type="button"
            className="eb-btn eb-btn--primary"
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            <Send size={15} aria-hidden />
          </button>
        </div>
      </div>

      {workspaceName ? (
        <p className="eb-sub" style={{ marginTop: 12, fontSize: 11 }}>
          Availability is always confirmed by {workspaceName}'s live schedule before anything is booked.
        </p>
      ) : null}

      <div className="eb-actions">
        <button type="button" className="eb-btn eb-btn--ghost" onClick={onManual}>
          <ArrowLeft size={15} aria-hidden /> Book manually instead
        </button>
      </div>
    </div>
  );
}
