"use client";

import { WIZARD_STEPS } from "@/lib/solutions/appointment-receptionist/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function WizardStepper({ currentIndex }: { currentIndex: number }) {
  return (
    <nav aria-label="Setup progress" className="w-full overflow-x-auto pb-1">
      <ol className="flex min-w-max items-center gap-0">
        {WIZARD_STEPS.map((step, index) => {
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
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
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
              {index < WIZARD_STEPS.length - 1 ? (
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
