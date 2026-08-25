"use client";

import type { SetupStep } from "@/lib/smart-routing/setup-readiness";
import { Check, Circle } from "lucide-react";
import Link from "next/link";

export function SetupStepper({
  steps,
  ready,
}: {
  steps: SetupStep[];
  ready: boolean;
}) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Setup checklist</h2>
        {ready ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            Smart Routing ready
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            Setup in progress
          </span>
        )}
      </div>
      <ul className="mt-4 space-y-2">
        {steps.map((step) => (
          <li key={step.key} className="flex items-start gap-2 text-sm">
            {step.complete ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              {step.href && !step.complete ? (
                <Link href={step.href} className="font-medium hover:text-primary hover:underline">
                  {step.label}
                </Link>
              ) : (
                <span className={step.complete ? "text-foreground" : "text-muted-foreground"}>
                  {step.label}
                </span>
              )}
              {step.optional ? (
                <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
