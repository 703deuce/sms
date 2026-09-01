"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

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
        "relative h-[22px] w-10 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "bg-primary shadow-inner"
          : "bg-slate-200 shadow-inner hover:bg-slate-300",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform duration-200 ease-out",
          active ? "translate-x-[20px]" : "translate-x-[3px]",
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
    <ol className="mb-6 flex flex-wrap items-center gap-y-3">
      {steps.map((label, i) => {
        const isActive = i === activeIndex;
        const isDone = i < activeIndex;
        return (
          <li key={label} className="flex items-center">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                  isDone
                    ? "bg-emerald-100 text-emerald-700"
                    : isActive
                      ? "bg-primary text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-400",
                )}
              >
                {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-[12px] font-semibold",
                  isActive ? "text-foreground" : isDone ? "text-slate-600" : "text-slate-400",
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <span
                className={cn(
                  "mx-3 hidden h-px w-8 sm:block",
                  isDone ? "bg-emerald-200" : "bg-slate-200",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
