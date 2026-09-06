"use client";

import { Check } from "lucide-react";

export type FlowStep = "service" | "datetime" | "info" | "payment" | "done" | "ai" | "waitlist";

const STEPS: Array<{ key: string; label: string }> = [
  { key: "service", label: "Service" },
  { key: "datetime", label: "Date & time" },
  { key: "info", label: "Your details" },
];

export function StepIndicator({ step }: { step: FlowStep }) {
  if (step === "ai" || step === "waitlist") return null;
  const activeIndex = step === "done" ? STEPS.length : STEPS.findIndex((s) => s.key === step);
  const clamped = activeIndex < 0 ? STEPS.length - 1 : activeIndex;

  return (
    <ol className="mb-7 flex items-center justify-center gap-1.5" aria-label="Booking progress">
      {STEPS.map((s, i) => {
        const complete = i < clamped;
        const active = i === clamped;
        return (
          <li key={s.key} className="flex items-center gap-1.5">
            <span
              aria-current={active ? "step" : undefined}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors"
              style={{
                background: complete || active ? "var(--primary)" : "var(--muted)",
                color: complete || active ? "var(--primary-foreground)" : "var(--muted-foreground)",
                boxShadow: active ? "0 0 0 4px rgba(67,56,202,0.15)" : undefined,
              }}
            >
              {complete ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span
              className={`hidden text-[12px] font-semibold sm:inline ${active ? "text-foreground" : "text-muted-foreground"}`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 ? <span className="mx-1 h-px w-6 bg-border" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}
