"use client";

import { Check } from "lucide-react";
import type { Step } from "../page";

const STEPS: Array<{ key: string; label: string }> = [
  { key: "service", label: "Service" },
  { key: "datetime", label: "Date & time" },
  { key: "info", label: "Your details" },
];

export default function StepIndicator({ step }: { step: Step }) {
  const activeIndex =
    step === "done"
      ? STEPS.length
      : step === "payment"
        ? STEPS.length - 1
        : STEPS.findIndex((s) => s.key === step);

  return (
    <ol className="eb-steps" aria-label="Booking progress">
      {STEPS.map((s, i) => {
        const complete = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li key={s.key} className="eb-steps__item">
            <span
              className={`eb-steps__dot${
                complete ? " eb-steps__dot--done" : active ? " eb-steps__dot--active" : ""
              }`}
              aria-current={active ? "step" : undefined}
            >
              {complete ? <Check size={12} strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            <span className={`eb-steps__label${active ? " eb-steps__label--active" : ""}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 ? <span className="eb-steps__sep" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}
