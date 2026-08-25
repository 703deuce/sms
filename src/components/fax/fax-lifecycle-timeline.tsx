"use client";

import { faxDisplayStatusLabel, type FaxDisplayStatus } from "@/lib/fax/fax-status";

const OUTBOUND_STEPS: FaxDisplayStatus[] = [
  "preparing",
  "queued",
  "connecting",
  "transmitting",
  "delivered",
];

export function FaxLifecycleTimeline({
  displayStatus,
  failureReason,
}: {
  displayStatus: FaxDisplayStatus;
  failureReason?: string | null;
}) {
  const isFailed = displayStatus === "failed";
  const isReceived = displayStatus === "received";
  const steps = isReceived ? (["received"] as FaxDisplayStatus[]) : OUTBOUND_STEPS;
  const currentIdx = steps.indexOf(displayStatus);

  return (
    <div className="rounded-lg border p-4">
      <h2 className="text-sm font-semibold">Delivery status</h2>
      <ol className="mt-4 space-y-3">
        {steps.map((step, idx) => {
          const done = isFailed ? idx < currentIdx : idx <= currentIdx;
          const active = step === displayStatus && !isFailed;
          return (
            <li key={step} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : "border border-muted-foreground/30 text-muted-foreground"
                } ${active ? "ring-2 ring-primary/40" : ""}`}
              >
                {done ? "✓" : idx + 1}
              </span>
              <span className={done ? "font-medium" : "text-muted-foreground"}>
                {faxDisplayStatusLabel(step)}
              </span>
            </li>
          );
        })}
        {isFailed ? (
          <li className="ml-9 text-sm text-destructive">
            Failed{failureReason ? `: ${failureReason}` : ""}
          </li>
        ) : null}
      </ol>
    </div>
  );
}
