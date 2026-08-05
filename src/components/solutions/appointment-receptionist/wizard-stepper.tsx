"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { WIZARD_STEPS } from "@/lib/solutions/appointment-receptionist/types";

export function WizardStepper({
  steps,
  currentIndex,
}: {
  steps: Array<(typeof WIZARD_STEPS)[number]>;
  currentIndex: number;
}) {
  return (
    <nav aria-label="Setup progress" className="w-full overflow-x-auto pb-1">
      <ol className="flex min-w-max items-center gap-0">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5 px-1 sm:px-2">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition",
                    done && "bg-success text-success-foreground",
                    active && "bg-primary text-primary-foreground",
                    !done && !active && "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 ? (
                <div
                  className={cn(
                    "mb-5 h-px w-6 sm:w-10",
                    index < currentIndex ? "bg-success" : "bg-border",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
