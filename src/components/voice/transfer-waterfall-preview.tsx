"use client";

import type { CallHandlingBehaviorSummary } from "@/lib/voice/call-handling/behavior-summary";

/** Read-only visual of waterfall order for owners (not runtime terminology). */
export function TransferWaterfallPreview({
  summary,
  fallbackLabel,
}: {
  summary: CallHandlingBehaviorSummary;
  fallbackLabel: string;
}) {
  if (!summary.transfersEnabled || summary.waterfallSteps.length === 0) return null;
  if (summary.routingMode !== "waterfall" && summary.waterfallSteps.length <= 1) return null;

  return (
    <div
      className="rounded-lg border border-dashed border-border bg-muted/20 p-4"
      aria-label="Transfer waterfall preview"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Incoming transfer request
      </p>
      <ol className="mt-3 space-y-0">
        {summary.waterfallSteps.map((step, idx) => (
          <li key={step.order} className="text-sm">
            <div className="rounded-md border border-border bg-card px-3 py-2">
              <span className="font-medium">{step.order}. {step.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {step.mode === "Warm" ? "Warm transfer" : "Direct transfer"} · Ring {step.ringSeconds}{" "}
                seconds
              </span>
            </div>
            {idx < summary.waterfallSteps.length - 1 ? (
              <p className="py-1.5 text-center text-xs text-muted-foreground">↓ if unanswered</p>
            ) : null}
          </li>
        ))}
        <li className="pt-1 text-sm">
          <p className="text-center text-xs text-muted-foreground">↓ nobody answers</p>
          <div className="mt-1 rounded-md border border-border bg-muted/40 px-3 py-2">
            <span className="font-medium">Fallback</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{fallbackLabel}</span>
          </div>
        </li>
      </ol>
    </div>
  );
}
