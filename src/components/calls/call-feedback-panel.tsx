"use client";

import { cn } from "@/lib/utils";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";

const REASONS = [
  "Wrong answer",
  "Didn't understand caller",
  "Bad voice response",
  "Booking problem",
  "Transfer problem",
  "Other",
] as const;

type Props = {
  callId: string;
  initialRating?: "good" | "needs_improvement" | null;
  initialReason?: string | null;
};

export function CallFeedbackPanel({ callId, initialRating, initialReason }: Props) {
  const [rating, setRating] = useState<"good" | "needs_improvement" | null>(
    initialRating ?? null,
  );
  const [reason, setReason] = useState(initialReason ?? "");
  const [customNote, setCustomNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean(initialRating));

  async function submit(
    nextRating: "good" | "needs_improvement",
    nextReason?: string,
  ) {
    setSaving(true);
    try {
      await fetch(`/api/voice/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: {
            rating: nextRating,
            reason: nextReason || undefined,
          },
        }),
      });
      setRating(nextRating);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[#111827]">Was this call handled correctly?</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void submit("good")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition",
            rating === "good"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb]",
          )}
        >
          <ThumbsUp className="h-4 w-4" />
          Good call
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setRating("needs_improvement");
            setSaved(false);
          }}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition",
            rating === "needs_improvement"
              ? "border-rose-300 bg-rose-50 text-rose-800"
              : "border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb]",
          )}
        >
          <ThumbsDown className="h-4 w-4" />
          Needs improvement
        </button>
      </div>
      {rating === "needs_improvement" && !saved ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-[#374151]">What went wrong?</p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  reason === r
                    ? "border-[#6366f1] bg-[#eef2ff] text-[#4f46e5]"
                    : "border-[#e5e7eb] text-[#6b7280]",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          {reason === "Other" ? (
            <textarea
              className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm"
              rows={3}
              placeholder="Tell us what went wrong…"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
            />
          ) : null}
          <button
            type="button"
            disabled={saving || !reason}
            onClick={() =>
              void submit(
                "needs_improvement",
                reason === "Other" ? customNote || reason : reason,
              )
            }
            className="rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Submit feedback
          </button>
        </div>
      ) : null}
      {saved && rating ? (
        <p className="mt-3 text-xs text-[#6b7280]">Thanks — your feedback was recorded.</p>
      ) : null}
    </div>
  );
}
