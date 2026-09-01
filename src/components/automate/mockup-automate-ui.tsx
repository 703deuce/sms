"use client";

import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, Search, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function MockupWizardStepper({
  steps,
  activeIndex,
}: {
  steps: string[];
  activeIndex: number;
}) {
  return (
    <div className="mb-8 flex items-center justify-center">
      <div className="flex flex-wrap items-center justify-center gap-0">
        {steps.map((label, i) => {
          const isActive = i === activeIndex;
          const isDone = i < activeIndex;
          return (
            <div key={label} className="flex items-center">
              <div className="flex items-center gap-2.5 px-2">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-colors duration-200",
                    isDone
                      ? "bg-emerald-500 text-white"
                      : isActive
                        ? "bg-primary text-white shadow-sm ring-4 ring-primary/15"
                        : "border border-border bg-card text-muted-foreground",
                  )}
                >
                  {isDone ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-[13px] font-semibold sm:inline",
                    isActive
                      ? "text-foreground"
                      : isDone
                        ? "text-foreground/80"
                        : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </div>
              {i < steps.length - 1 ? (
                <div
                  className={cn(
                    "mx-1 hidden h-px w-10 sm:block md:w-16",
                    isDone ? "bg-emerald-400" : "bg-border",
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MockupWizardSection({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6 text-center">
      <h2 className="font-display text-[20px] font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {description ? (
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function MockupWizardFooter({
  backLabel = "Back",
  nextLabel = "Next",
  onBack,
  onNext,
  onCancel,
  nextDisabled,
  nextLoading,
  extraActions,
}: {
  backLabel?: string;
  nextLabel?: string;
  onBack?: () => void;
  onNext?: () => void;
  onCancel?: () => void;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  extraActions?: ReactNode;
}) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
      <div>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 items-center gap-1 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/60"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            {backLabel}
          </button>
        ) : onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center rounded-lg px-4 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {extraActions}
        {onNext ? (
          <button
            type="button"
            disabled={nextDisabled || nextLoading}
            onClick={onNext}
            className="inline-flex h-10 items-center gap-1 rounded-lg bg-primary px-5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {nextLoading ? "Saving…" : nextLabel}
            {!nextLoading ? <ChevronRight className="h-4 w-4" /> : null}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function MockupTriggerCard({
  icon: Icon,
  label,
  description,
  selected,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center rounded-xl border p-5 text-center transition-all duration-150",
        selected
          ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20"
          : "border-border bg-card hover:border-primary/30 hover:bg-muted/40",
      )}
    >
      <span
        className={cn(
          "mb-3 flex h-11 w-11 items-center justify-center rounded-full transition-colors",
          selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-[14px] font-semibold text-foreground">{label}</p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
    </button>
  );
}

export function MockupListToolbar({
  searchPlaceholder,
  searchValue,
  onSearchChange,
  filterSlot,
  createSlot,
}: {
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filterSlot?: ReactNode;
  createSlot: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {filterSlot}
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-[13px] outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
            placeholder={searchPlaceholder}
          />
        </div>
      </div>
      {createSlot}
    </div>
  );
}

export function MockupTablePagination({
  total,
  page = 1,
  pageSize = 10,
}: {
  total: number;
  page?: number;
  pageSize?: number;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-border px-1 pt-3 text-[12px] text-muted-foreground">
      <span className="tabular-nums">
        Showing {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[52px] px-1 text-center font-medium tabular-nums text-foreground">
          {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function MockupDetailTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <div className="mb-6 flex gap-6 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={cn(
            "-mb-px border-b-2 pb-2.5 text-[13px] font-semibold transition-colors",
            active === tab
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

export function MockupMessageToolbar({
  onInsert,
}: {
  onInsert: (token: string) => void;
}) {
  const tokens = ["{{firstName}}", "{{lastName}}", "{{businessName}}"];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
      <span className="text-[11px] font-medium text-muted-foreground">Insert:</span>
      {tokens.map((token) => (
        <button
          key={token}
          type="button"
          onClick={() => onInsert(token)}
          className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
        >
          {token}
        </button>
      ))}
    </div>
  );
}
