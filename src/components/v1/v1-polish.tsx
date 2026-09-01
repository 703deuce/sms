"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
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
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[12px] font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>
        ) : null}
        <div className="mt-1 flex items-start gap-3.5">
          {emoji ? (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[22px] shadow-sm ring-1 ring-primary/10">
              {emoji}
            </span>
          ) : Icon ? (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Icon className="h-5 w-5" />
            </span>
          ) : null}
          <div className="min-w-0 pt-0.5">
            <h1 className="font-display text-[24px] font-bold leading-tight tracking-tight text-foreground">
              {title}
            </h1>
            {description ? (
              <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1.5">{actions}</div>
      ) : null}
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
    <div className="mb-6 overflow-x-auto pb-0.5">
      <div className="flex min-w-max items-center gap-1 rounded-xl border border-border bg-card p-1.5 shadow-sm">
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
                "flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active && "bg-primary text-primary-foreground shadow-sm",
                done && !active && "text-primary",
                !active && !done && "text-muted-foreground",
                clickable && !active && "hover:bg-muted",
                !clickable && "cursor-default opacity-80",
              )}
            >
              <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                {done ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="text-[16px] leading-none">{step.emoji}</span>
                )}
              </span>
              <span className="hidden sm:block">
                <span className="block text-[12px] font-semibold leading-tight">{step.label}</span>
                {step.hint ? (
                  <span
                    className={cn(
                      "block text-[10px] leading-tight",
                      active
                        ? "text-primary-foreground/80"
                        : done
                          ? "text-primary/70"
                          : "text-muted-foreground/80",
                    )}
                  >
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
    <div className="mb-6 rounded-xl border border-primary/15 bg-primary/[0.04] px-4 py-3.5">
      <div className="flex items-start gap-3">
        {emoji ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card text-[16px] shadow-sm ring-1 ring-primary/10">
            {emoji}
          </span>
        ) : null}
        <div className="min-w-0 pt-0.5">
          <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
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
            className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-[13px] font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ← Back
          </button>
        ) : onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-lg px-4 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            className="inline-flex h-9 items-center rounded-lg bg-primary px-5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
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
            <Link href={item.href} className="font-medium text-primary hover:underline">
              {item.label}
            </Link>
          ) : item.onClick ? (
            <button
              type="button"
              onClick={item.onClick}
              className="font-medium text-primary hover:underline"
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-[28px] shadow-sm ring-1 ring-border/60">
        {emoji}
      </span>
      <p className="mt-4 text-[16px] font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
        {description}
      </p>
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
        "relative w-full rounded-xl border p-4 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary/50 bg-primary/[0.05] shadow-sm ring-1 ring-primary/20"
          : "border-border bg-card hover:border-primary/30 hover:shadow-sm",
      )}
    >
      {selected ? (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : null}
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg text-[18px] transition-colors",
          selected ? "bg-primary/10" : "bg-muted",
        )}
      >
        {emoji}
      </span>
      <p className="mt-2.5 text-[14px] font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
    </button>
  );
}
