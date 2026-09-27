"use client";

import type { WizardStepStatus } from "@/lib/mctb/voice-agent/step-readiness";
import { Button } from "@/newui-transplant/components/ui/button";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function WizardStepper({
  steps,
  currentIndex,
  presentation = "legacy",
  stepStatuses,
  onStepSelect,
}: {
  steps: Array<{ id: string; label: string }>;
  currentIndex: number;
  presentation?: "legacy" | "mctb" | "opus";
  stepStatuses?: Partial<Record<string, WizardStepStatus>>;
  onStepSelect?: (index: number) => void;
}) {
  if (presentation === "opus") {
    return (
      <nav aria-label="Setup progress" className="-mx-4 overflow-x-auto border-b px-4 md:mx-0 md:px-0">
        <ol className="flex min-w-max gap-6 md:gap-8">
          {steps.map((step, index) => {
            const active = index === currentIndex;
            const done = index < currentIndex;
            return (
              <li key={step.id}>
                {onStepSelect ? (
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => onStepSelect(index)}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "relative inline-flex h-10 items-center gap-2 rounded-none pb-3 text-sm no-underline hover:no-underline",
                      active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{step.label}</span>
                    {active ? (
                      <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
                    ) : null}
                  </Button>
                ) : (
                  <span
                    className={cn(
                      "relative inline-flex h-10 items-center gap-2 pb-3 text-sm",
                      active ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{step.label}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  if (presentation === "mctb") {
    return (
      <nav aria-label="Setup progress" className="mctb-va-stepper w-full overflow-x-auto">
        <ol className="flex min-w-max items-center gap-0">
          {steps.map((step, index) => {
            const done =
              stepStatuses?.[step.id] === "COMPLETE" || index < currentIndex;
            const active = index === currentIndex;
            const attention = stepStatuses?.[step.id] === "NEEDS_ATTENTION";
            const blocked = stepStatuses?.[step.id] === "BLOCKED";
            const circleClass = cn(
              "step-circle relative",
              active && "step-circle--active",
              done && !active && "step-circle--done",
              attention && "step-circle--attention",
              blocked && !active && "step-circle--attention",
            );
            const labelClass = cn("step-label", active && "step-label--active");
            const content = (
              <>
                <span className={circleClass}>
                  {done && !active ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className={labelClass}>{step.label}</span>
              </>
            );
            return (
              <li key={step.id} className="flex items-center">
                {onStepSelect ? (
                  <button
                    type="button"
                    className="flex flex-col items-center gap-0 px-1 sm:px-2"
                    onClick={() => onStepSelect(index)}
                    aria-current={active ? "step" : undefined}
                  >
                    {content}
                  </button>
                ) : (
                  <div className="flex flex-col items-center gap-0 px-1 sm:px-2">{content}</div>
                )}
                {index < steps.length - 1 ? (
                  <div
                    className={cn(
                      "mb-5 h-px w-5 sm:w-8",
                      done ? "bg-[var(--mctb-va-accent,#3d5a80)]/40" : "bg-[#e2e6ec]",
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
