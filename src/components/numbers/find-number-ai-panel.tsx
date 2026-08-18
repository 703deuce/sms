"use client";

import { cn } from "@/lib/utils";
import type { AiNumberSearchMessage } from "@/lib/premium-numbers/ai-number-search/types";
import { ArrowRight, Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const PRIMARY = "#4f46e5";

const STARTER_MESSAGES: AiNumberSearchMessage[] = [
  {
    id: "starter-1",
    role: "user",
    content:
      "I'm looking for a number that sounds professional but also friendly. Something that would work well for a real estate business.",
    createdAt: "",
  },
  {
    id: "starter-2",
    role: "assistant",
    content: "Do you have any recommendations? I'm open to both toll-free and local numbers.",
    createdAt: "",
  },
];

type Chip = { id: string; label: string; kind: "explicit" | "ai" | "filter" };

export function FindNumberAiPanel({
  sessionId,
  messages,
  understandingChips,
  loading,
  loadingStage,
  suggestedActions,
  onSend,
  onQuickAction,
  onClear,
  onRemoveChip,
  className,
  variant = "default",
}: {
  sessionId: string | null;
  messages: AiNumberSearchMessage[];
  understandingChips: Chip[];
  loading: boolean;
  loadingStage?: string;
  suggestedActions: string[];
  onSend: (message: string, quickAction?: string) => void;
  onQuickAction: (action: string) => void;
  onClear: () => void;
  onRemoveChip: (chipId: string) => void;
  className?: string;
  variant?: "default" | "mockup";
}) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const isMockup = variant === "mockup";
  const displayMessages = messages.length > 0 ? messages : isMockup ? STARTER_MESSAGES : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div
      className={cn(
        "flex h-full min-h-[420px] flex-col rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-[#f3f4f6] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#4f46e5]" />
          <h2 className="text-[14px] font-semibold text-[#111827]">
            {isMockup ? "Your AI Concierge" : "AI Concierge"}
          </h2>
        </div>
        {!isMockup ? (
          <button
            type="button"
            onClick={onClear}
            className="text-[12px] font-medium text-[#6366f1] hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>

      {understandingChips.length > 0 ? (
        <div className="border-b border-[#f3f4f6] px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
            AI understands
          </p>
          <div className="flex flex-wrap gap-1.5">
            {understandingChips.map((chip) => (
              <span
                key={chip.id}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  chip.kind === "ai"
                    ? "bg-[#f5f3ff] text-[#7c3aed]"
                    : chip.kind === "explicit"
                      ? "bg-[#eef2ff] text-[#4f46e5]"
                      : "bg-[#f3f4f6] text-[#374151]",
                )}
              >
                {chip.label}
                <button
                  type="button"
                  className="rounded hover:bg-black/5"
                  aria-label={`Remove ${chip.label}`}
                  onClick={() => onRemoveChip(chip.id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {displayMessages.length === 0 ? (
          <p className="text-[13px] text-[#6b7280]">
            Describe the number you want in plain language. I&apos;ll search live inventory.
          </p>
        ) : (
          displayMessages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "max-w-[95%] rounded-xl px-3 py-2.5 text-[13px] leading-relaxed",
                m.role === "user"
                  ? "ml-auto bg-[#4f46e5] text-white"
                  : "bg-[#f3f4f6] text-[#374151]",
              )}
            >
              {m.content}
            </div>
          ))
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-[#6b7280]">
            <Loader2 className="h-4 w-4 animate-spin text-[#4f46e5]" />
            {loadingStage || "Finding your best numbers…"}
          </div>
        ) : null}
        {!loading && suggestedActions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {suggestedActions.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => onQuickAction(action)}
                className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-[11px] font-semibold text-[#4f46e5] hover:bg-[#eef2ff]"
              >
                {action.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[#f3f4f6] px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim() || loading) return;
            onSend(draft.trim());
            setDraft("");
          }}
          className="flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={isMockup ? "Give me some more options…" : "Ask AI…"}
            className="h-11 flex-1 rounded-lg border border-[#e5e7eb] px-3 text-[13px] outline-none focus:border-[#6366f1]"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !draft.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-white disabled:opacity-50"
            style={{ backgroundColor: PRIMARY }}
            aria-label="Send"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
        {!isMockup && sessionId ? (
          <p className="mt-2 text-[10px] text-[#9ca3af]">Session active</p>
        ) : null}
      </div>
    </div>
  );
}
