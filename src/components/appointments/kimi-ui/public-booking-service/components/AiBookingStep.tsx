import { useEffect, useRef } from "react";
import type { Slot } from "../mock-data";
import { Button, Input } from "./ui";
import { cn, formatSlotTime } from "./utils";
import { ArrowLeft, Send, Sparkles } from "lucide-react";

type AiMessage = { role: "user" | "assistant"; content: string };

const GREETING =
  "Hi! Tell me what you're looking for — for example, “a cleaning next week in the morning” — and I'll find real openings from the live schedule.";

export function AiBookingStep({
  timezone,
  workspaceName,
  messages,
  input,
  onInputChange,
  onSend,
  loading,
  error,
  slots,
  onSelectSlot,
  onBack,
}: {
  timezone: string;
  workspaceName?: string;
  messages: AiMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void | Promise<void>;
  loading: boolean;
  error?: string;
  slots: Slot[];
  onSelectSlot: (slot: Slot) => void;
  onBack: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const displayMessages = messages.length > 0 ? messages : [{ role: "assistant" as const, content: GREETING }];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [displayMessages, loading, slots]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    await onSend();
  }

  return (
    <div className="fade-in flex h-[560px] flex-col">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 self-start text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Pick a time manually
      </button>

      <div className="flex items-center gap-2.5 border-b border-border pb-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">Scheduling assistant</p>
          <p className="text-[11px] text-muted-foreground">
            {workspaceName ? `Powered by ${workspaceName}'s live availability` : "Intelligent scheduling assistant"}
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="chat-scroll flex-1 space-y-3 overflow-y-auto py-4" aria-live="polite">
        {displayMessages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                m.role === "user"
                  ? "rounded-br-md bg-primary text-primary-foreground"
                  : "rounded-bl-md bg-muted text-foreground",
              )}
            >
              {m.content}
            </div>
          </div>
        ))}

        {slots.length > 0 ? (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-[13px] text-foreground">
              <p className="mb-2 font-semibold">Available times</p>
              <div className="flex flex-wrap gap-1.5">
                {slots.map((slot) => (
                  <button
                    key={slot.startsAt}
                    type="button"
                    onClick={() => onSelectSlot(slot)}
                    className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] font-semibold text-foreground transition-all hover:border-primary hover:text-primary"
                  >
                    {new Date(slot.startsAt).toLocaleDateString(undefined, { weekday: "short" })}{" "}
                    {formatSlotTime(slot.startsAt, timezone)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3 text-[13px] text-muted-foreground">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="px-1 text-[12px] text-destructive" role="alert">{error}</p>
      ) : null}

      <div className="flex items-center gap-2 border-t border-border pt-3">
        <Input
          className="mt-0"
          placeholder="e.g. Cleaning next week, mornings only"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
          aria-label="Message the scheduling assistant"
          disabled={loading}
        />
        <Button size="md" onClick={() => void send()} disabled={loading || !input.trim()} aria-label="Send message">
          {loading ? "…" : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
