"use client";

import { cn } from "@/lib/utils";
import type { AiNumberSearchMessage } from "@/lib/premium-numbers/ai-number-search/types";
import { Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const PRIMARY = "#4338ca";

const SUGGESTED_PROMPTS = [
  "Find me a memorable number for an electrician",
  "Find me a 571 business number under $75",
  "Find something with SPARK or WIRE",
  "Find the easiest number to remember",
  "Find me something good for advertising",
];

const QUICK_ACTIONS = [
  { id: "cheaper", label: "Cheaper" },
  { id: "better_patterns", label: "Better patterns" },
  { id: "compare_top_3", label: "Compare top 3" },
  { id: "try_another_area", label: "Try another area code" },
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
}) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const actions =
    suggestedActions.length > 0
      ? suggestedActions.map((id) => ({
          id,
          label: id.replace(/_/g, " "),
        }))
      : QUICK_ACTIONS;

  return (
    <div
      className={cn(
        "flex h-full min-h-[420px] flex-col rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-[#f3f4f6] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#4338ca]" />
          <h2 className="text-[14px] font-semibold text-[#111827]">AI Concierge</h2>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-[12px] font-medium text-[#6366f1] hover:underline"
        >
          Clear
        </button>
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
                      ? "bg-[#eef2ff] text-[#4338ca]"
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
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[13px] text-[#6b7280]">
              Describe the number you want in plain language. I&apos;ll search live inventory —
              never made-up numbers.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-[12px] text-[#374151] hover:border-[#c7d2fe] hover:bg-[#eef2ff]"
                  onClick={() => onSend(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "max-w-[95%] rounded-xl px-3 py-2 text-[13px] leading-relaxed",
                m.role === "user"
                  ? "ml-auto bg-[#4338ca] text-white"
                  : "bg-[#f9fafb] text-[#374151]",
              )}
            >
              {m.content}
            </div>
          ))
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-[#6b7280]">
            <Loader2 className="h-4 w-4 animate-spin text-[#4338ca]" />
            {loadingStage || "Finding your best numbers…"}
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[#f3f4f6] px-4 py-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {actions.slice(0, 4).map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={loading}
              className="rounded-lg border border-[#e5e7eb] px-2.5 py-1 text-[11px] font-semibold text-[#374151] hover:bg-[#f9fafb] disabled:opacity-50"
              onClick={() => onQuickAction(a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>
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
            placeholder="Ask AI…"
            className="h-10 flex-1 rounded-lg border border-[#e5e7eb] px-3 text-[13px] outline-none focus:border-[#6366f1]"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !draft.trim()}
            className="h-10 rounded-lg px-4 text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: PRIMARY }}
          >
            Send
          </button>
        </form>
        {sessionId ? (
          <p className="text-[10px] text-[#9ca3af]">Session active</p>
        ) : null}
      </div>
    </div>
  );
}
