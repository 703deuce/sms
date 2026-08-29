"use client";

import { cn } from "@/lib/utils";

export function AutoReplyStatusToggle({
  active,
  disabled,
  onChange,
  label = "Toggle auto reply status",
}: {
  active: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!active)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50",
        active ? "bg-primary" : "bg-slate-300",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
          active ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

export function AutoReplyWizardStepper({
  steps,
  activeIndex,
}: {
  steps: string[];
  activeIndex: number;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {steps.map((label, i) => {
        const isActive = i === activeIndex;
        const isDone = i < activeIndex;
        return (
          <div key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                isDone
                  ? "bg-emerald-600 text-white"
                  : isActive
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-400",
              )}
            >
              {isDone ? "✓" : i + 1}
            </span>
            <span
              className={cn(
                "text-[12px] font-semibold",
                isActive ? "text-primary" : "text-slate-500",
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 ? (
              <span className="mx-1 hidden h-px w-8 bg-slate-200 sm:block" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
