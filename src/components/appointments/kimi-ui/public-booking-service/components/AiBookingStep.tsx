import { useEffect, useRef, useState } from "react";
import type { Slot } from "../mock-data";
import { aiSeedMessages } from "../mock-data";
import { Button, Input } from "./ui";
import { cn, formatSlotTime } from "./utils";
import { ArrowLeft, Send, Sparkles } from "lucide-react";

type Message = { role: "assistant" | "user"; content: string; slots?: Slot[] };

const cannedReplies: Message[] = [
  {
    role: "assistant",
    content:
      "Got it — mornings are popular this week. The earliest I can offer is Tuesday at 9:30 AM. Want that one, or should I check afternoons?",
    slots: aiSeedMessages[2].slots,
  },
  {
    role: "assistant",
    content:
      "No problem. I've widened the search to next week — there are more options on Monday and Tuesday. Tap any time to select it.",
    slots: aiSeedMessages[2].slots,
  },
];

export function AiBookingStep({
  timezone,
  onSelectSlot,
  onBack,
}: {
  timezone: string;
  onSelectSlot: (slot: Slot) => void;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>(aiSeedMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState("");
  const replyIndex = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    const reply = cannedReplies[replyIndex.current % cannedReplies.length];
    replyIndex.current += 1;
    setMessages((prev) => [...prev, reply]);
    setLoading(false);
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
          <p className="text-[11px] text-muted-foreground">Intelligent scheduling assistant</p>
        </div>
      </div>

      <div ref={scrollRef} className="chat-scroll flex-1 space-y-3 overflow-y-auto py-4" aria-live="polite">
        {messages.map((m, i) => (
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
              {m.slots ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {m.slots.map((slot) => (
                    <button
                      key={slot.startsAt}
                      type="button"
                      onClick={() => {
                        setSelected(slot.startsAt);
                        onSelectSlot(slot);
                      }}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-all",
                        selected === slot.startsAt
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-primary hover:text-primary",
                      )}
                    >
                      {new Date(slot.startsAt).toLocaleDateString(undefined, { weekday: "short" })}{" "}
                      {formatSlotTime(slot.startsAt, timezone)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
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

      <div className="flex items-center gap-2 border-t border-border pt-3">
        <Input
          className="mt-0"
          placeholder="e.g. Cleaning next week, mornings only"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          aria-label="Message the scheduling assistant"
        />
        <Button size="md" onClick={send} disabled={loading || !input.trim()} aria-label="Send message">
          {loading ? "…" : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
