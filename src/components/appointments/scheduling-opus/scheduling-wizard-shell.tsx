"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { ArOpusPage } from "@/newui-transplant/components/appointment-reminders/ar-opus-layout";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { Button } from "@/newui-transplant/components/ui/button";
import { cn } from "@/lib/utils";
import "./scheduling-wizard-editor.css";

export type WizardStep = {
  id: string;
  label: string;
  icon: LucideIcon;
};

type SchedulingWizardShellProps = {
  backHref: string;
  backLabel: string;
  title: string;
  description: string;
  headerAction?: React.ReactNode;
  steps: readonly WizardStep[];
  currentStep: number;
  onStepSelect?: (index: number) => void;
  editor: React.ReactNode;
  preview: React.ReactNode;
  footerLeft: React.ReactNode;
  footerRight: React.ReactNode;
  showPreviewOnMobile?: boolean;
};

export function SchedulingWizardShell({
  backHref,
  backLabel,
  title,
  description,
  headerAction,
  steps,
  currentStep,
  onStepSelect,
  editor,
  preview,
  footerLeft,
  footerRight,
  showPreviewOnMobile = false,
}: SchedulingWizardShellProps) {
  return (
    <ArOpusPage className="pb-10">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <Link
            href={backHref}
            className="text-sm font-medium text-primary hover:underline"
          >
            ← {backLabel}
          </Link>
          <div>
            <h1 className="text-[1.625rem] font-semibold tracking-tight text-balance">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {headerAction ? <div className="flex shrink-0 flex-wrap gap-2">{headerAction}</div> : null}
      </header>

      <nav
        className={cn(
          OPUS_CARD,
          "mb-6 flex min-h-[3.875rem] flex-wrap items-center gap-1.5 p-2 md:gap-2 md:px-3",
        )}
        aria-label="Wizard progress"
      >
        {steps.map((step, index) => {
          const done = index < currentStep;
          const current = index === currentStep;
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              type="button"
              className={cn(
                "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                current && "bg-primary/10 text-primary ring-1 ring-primary/25",
                done && !current && "bg-muted/60 text-foreground",
                !done && !current && "text-muted-foreground hover:bg-muted/40",
              )}
              aria-current={current ? "step" : undefined}
              onClick={() => onStepSelect?.(index)}
              disabled={!onStepSelect}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border",
                  current && "border-primary bg-primary text-primary-foreground",
                  done && "border-primary/40 bg-primary/15 text-primary",
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sr-only sm:hidden">
                Step {index + 1} of {steps.length}: {step.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2.1fr)_minmax(320px,1fr)] lg:gap-6">
        <div className={cn(OPUS_CARD, "scheduling-wizard-editor min-w-0 space-y-6 p-6")}>{editor}</div>
        <aside
          className={cn(
            "min-w-0 lg:sticky lg:top-20 lg:self-start",
            !showPreviewOnMobile && "hidden lg:block",
          )}
        >
          {preview}
        </aside>
      </div>

      <footer
        className={cn(
          OPUS_CARD,
          "mt-8 flex flex-col gap-3 border-t bg-card/80 p-4 sm:flex-row sm:items-center sm:justify-between",
        )}
      >
        <div>{footerLeft}</div>
        <div className="flex flex-wrap items-center justify-end gap-2">{footerRight}</div>
      </footer>
    </ArOpusPage>
  );
}
