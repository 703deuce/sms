"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { LucideIcon, ReactNode } from "react";

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
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                    isDone
                      ? "bg-emerald-600 text-white"
                      : isActive
                        ? "bg-primary text-white"
                        : "border border-slate-200 bg-white text-slate-400",
                  )}
                >
                  {isDone ? "✓" : i + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-[13px] font-semibold sm:inline",
                    isActive ? "text-primary" : isDone ? "text-slate-700" : "text-slate-400",
                  )}
                >
                  {label}
                </span>
              </div>
              {i < steps.length - 1 ? (
                <div
                  className={cn(
                    "mx-1 hidden h-px w-10 sm:block md:w-16",
                    isDone ? "bg-primary/40" : "bg-slate-200",
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
      <h2 className="font-display text-[22px] font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-1.5 text-[14px] text-slate-500">{description}</p> : null}
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
    <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-6">
      <div>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            {backLabel}
          </button>
        ) : onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center rounded-lg px-4 text-[13px] font-semibold text-slate-500 hover:text-slate-700"
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
            className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-[13px] font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {nextLoading ? "Saving…" : nextLabel}
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
        "flex flex-col items-center rounded-xl border p-5 text-center transition",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50",
      )}
    >
      <span
        className={cn(
          "mb-3 flex h-11 w-11 items-center justify-center rounded-full",
          selected ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-500",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-[14px] font-semibold text-slate-900">{label}</p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">{description}</p>
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
      <div className="flex flex-1 items-center gap-2">
        {filterSlot}
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] outline-none placeholder:text-slate-400 focus:border-primary"
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
    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[12px] text-slate-500">
      <span>
        Showing {start}-{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 font-medium text-slate-700">
          {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40"
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
    <div className="mb-6 flex gap-6 border-b border-slate-200">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={cn(
            "-mb-px border-b-2 pb-2.5 text-[13px] font-semibold transition",
            active === tab
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-slate-700",
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
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
      {tokens.map((token) => (
        <button
          key={token}
          type="button"
          onClick={() => onInsert(token)}
          className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-primary hover:text-primary"
        >
          {token}
        </button>
      ))}
    </div>
  );
}
