"use client";

import { Check } from "lucide-react";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { cn } from "@/lib/utils";

type Step = { id: string; label: string };

type Props = {
  steps: Step[];
  currentIndex: number;
  className?: string;
};

export function PublicFlowStepRail({ steps, currentIndex, className }: Props) {
  return (
    <nav
      className={cn(OPUS_CARD, "mb-6 flex min-h-12 flex-wrap items-center gap-2 p-2", className)}
      aria-label="Progress"
    >
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        return (
          <div
            key={step.id}
            className={cn(
              "flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium",
              current && "bg-primary/10 text-primary ring-1 ring-primary/25",
              done && "text-foreground",
              !done && !current && "text-muted-foreground",
            )}
            aria-current={current ? "step" : undefined}
          >
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full border text-xs",
                current && "border-primary bg-primary text-primary-foreground",
                done && "border-primary/40 bg-primary/15 text-primary",
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : index + 1}
            </span>
            <span className="hidden sm:inline">{step.label}</span>
          </div>
        );
      })}
    </nav>
  );
}
