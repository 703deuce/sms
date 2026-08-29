"use client";

import { AutoReplyStatusToggle } from "@/components/auto-replies/auto-reply-ui";
import { cn } from "@/lib/utils";

export function DripStatusToggle(props: {
  active: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return <AutoReplyStatusToggle {...props} label="Toggle drip campaign status" />;
}

export function DripWizardStepper({
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
