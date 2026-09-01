"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function V1PageHeader({
  eyebrow,
  title,
  description,
  emoji,
  icon: Icon,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  emoji?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[12px] font-semibold uppercase tracking-wide text-indigo-600">{eyebrow}</p>
        ) : null}
        <div className="mt-1 flex items-center gap-3">
          {emoji ? (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-indigo-50 text-[22px]">
              {emoji}
            </span>
          ) : Icon ? (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-indigo-600 text-white">
              <Icon className="h-5 w-5" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-tight text-foreground">{title}</h1>
            {description ? (
              <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export type WizardStep = {
  id: string;
  label: string;
  emoji: string;
  hint?: string;
};

export function V1WizardStepper({
  steps,
  activeIndex,
  onStepClick,
}: {
  steps: WizardStep[];
  activeIndex: number;
  onStepClick?: (index: number) => void;
}) {
  return (
    <div className="mb-6 overflow-x-auto">
      <div className="flex min-w-max items-center gap-2 rounded-[14px] border border-border bg-card p-2 shadow-sm">
        {steps.map((step, i) => {
          const active = i === activeIndex;
          const done = i < activeIndex;
          const clickable = onStepClick && (done || active);
          return (
            <button
              key={step.id}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick(i)}
              className={cn(
                "flex items-center gap-2 rounded-[10px] px-3 py-2 text-left transition",
                active && "bg-indigo-600 text-white shadow-sm",
                done && !active && "bg-indigo-50 text-indigo-700",
                !active && !done && "text-muted-foreground",
                clickable && "hover:bg-muted/60",
                !clickable && "cursor-default",
              )}
            >
              <span className="text-[16px] leading-none">{step.emoji}</span>
              <span className="hidden sm:block">
                <span className="block text-[12px] font-semibold">{step.label}</span>
                {step.hint && active ? (
                  <span className={cn("text-[10px]", active ? "text-indigo-100" : "text-muted-foreground")}>
                    {step.hint}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function V1WizardSection({
  emoji,
  title,
  description,
}: {
  emoji?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5 rounded-[12px] border border-indigo-100 bg-indigo-50/40 px-4 py-3">
      <div className="flex items-start gap-2">
        {emoji ? <span className="text-[18px] leading-none">{emoji}</span> : null}
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          {description ? <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function V1WizardFooter({
  onBack,
  onCancel,
  onNext,
  nextLabel = "Next",
  nextDisabled,
  nextLoading,
  extraActions,
}: {
  onBack?: () => void;
  onCancel?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  extraActions?: React.ReactNode;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
      <div className="flex gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="h-9 rounded-lg border border-border bg-card px-4 text-[13px] font-medium text-foreground hover:bg-muted"
          >
            ← Back
          </button>
        ) : onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-lg px-4 text-[13px] font-medium text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {extraActions}
        {onNext ? (
          <button
            type="button"
            disabled={nextDisabled || nextLoading}
            onClick={onNext}
            className="h-9 rounded-lg bg-indigo-600 px-5 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {nextLoading ? "Saving…" : nextLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function V1Breadcrumb({
  items,
}: {
  items: Array<{ label: string; href?: string; onClick?: () => void }>;
}) {
  return (
    <p className="mb-3 text-[12px] text-muted-foreground">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`}>
          {i > 0 ? <span className="mx-1.5 text-border">/</span> : null}
          {item.href ? (
            <Link href={item.href} className="font-medium text-indigo-600 hover:underline">
              {item.label}
            </Link>
          ) : item.onClick ? (
            <button
              type="button"
              onClick={item.onClick}
              className="font-medium text-indigo-600 hover:underline"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </p>
  );
}

export function V1EmptyState({
  emoji,
  title,
  description,
  action,
}: {
  emoji: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
      <span className="text-[40px]">{emoji}</span>
      <p className="mt-4 text-[16px] font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-[13px] text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function V1ChoiceCard({
  selected,
  emoji,
  title,
  description,
  onClick,
}: {
  selected?: boolean;
  emoji: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[14px] border p-4 text-left transition hover:shadow-sm",
        selected
          ? "border-indigo-400 bg-indigo-50/60 ring-2 ring-indigo-200"
          : "border-border bg-card hover:border-indigo-200",
      )}
    >
      <span className="text-[22px]">{emoji}</span>
      <p className="mt-2 text-[14px] font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
    </button>
  );
}
