"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function ReceptionistWizardStepper({
  steps,
  currentIndex,
}: {
  steps: Array<{ id: string; label: string }>;
  currentIndex: number;
}) {
  return (
    <nav aria-label="Setup progress" className="w-full">
      <ol className="flex items-center justify-center gap-0">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step.id} className="flex items-center">
              <div className="flex flex-col items-center gap-2 px-2 sm:px-4">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition",
                    done && "bg-primary text-primary-foreground",
                    active && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                    !done && !active && "border-2 border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-center text-xs font-medium sm:block",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 ? (
                <div
                  className={cn(
                    "mb-6 h-0.5 w-12 sm:w-20",
                    index < currentIndex ? "bg-primary" : "bg-border",
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
