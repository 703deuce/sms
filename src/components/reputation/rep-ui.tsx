"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  Download,
  Filter,
  Info,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const REP_GREEN = "#137752";
export const REP_GREEN_SOFT = "#ECFDF3";

export const rep = {
  page: "space-y-4",
  card: "rounded-xl border border-[#E6EAF0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
  cardPad: "rounded-xl border border-[#E6EAF0] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
  title: "text-[28px] font-bold tracking-tight text-[#101828]",
  subtitle: "mt-1 text-sm text-[#667085]",
  label: "text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]",
  btnPrimary:
    "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#137752] px-4 text-sm font-semibold text-white transition hover:bg-[#0f6244]",
  btnSecondary:
    "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3.5 text-sm font-semibold text-[#344054] transition hover:bg-[#F9FAFB]",
  link: "inline-flex items-center gap-0.5 text-sm font-semibold text-[#137752] hover:underline",
  input:
    "h-10 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-[#137752]",
  select:
    "h-10 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm font-medium text-[#344054] outline-none focus:border-[#137752]",
  tabActive: "border-[#137752] text-[#137752]",
  tabIdle: "border-transparent text-[#667085] hover:text-[#101828]",
};

export function RepPageHeader({
  title,
  subtitle,
  dateRangeLabel = "Last 90 days",
  actions,
  primaryAction,
  showCompare = false,
  showExport = false,
  showFilters = false,
  filterLabel = "Filters",
}: {
  title: string;
  subtitle: string;
  dateRangeLabel?: string;
  actions?: React.ReactNode;
  primaryAction?: React.ReactNode;
  showCompare?: boolean;
  showExport?: boolean;
  showFilters?: boolean;
  filterLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className={cn(rep.title, "inline-flex items-center gap-2")}>
          {title}
          <Info className="h-4 w-4 text-[#98A2B3]" aria-hidden />
        </h1>
        <p className={rep.subtitle}>{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        <div className={cn(rep.btnSecondary, "pointer-events-none cursor-default")}>
          <Calendar className="h-4 w-4 text-[#667085]" />
          {dateRangeLabel}
        </div>
        {showCompare ? (
          <button type="button" className={rep.btnSecondary} disabled title="Coming soon">
            Compare
          </button>
        ) : null}
        {showExport ? (
          <button type="button" className={rep.btnSecondary} disabled title="Coming soon">
            <Download className="h-4 w-4" />
            Export
          </button>
        ) : null}
        {showFilters ? (
          <button type="button" className={rep.btnPrimary} disabled title="Use filters below">
            <Filter className="h-4 w-4" />
            {filterLabel}
          </button>
        ) : null}
        {primaryAction}
      </div>
    </div>
  );
}

export function RepTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="-mb-px flex flex-wrap gap-5 border-b border-[#E6EAF0]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "-mb-px border-b-2 pb-2.5 text-sm font-semibold transition-colors",
            active === tab.id ? rep.tabActive : rep.tabIdle
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function RepMetricCard({
  label,
  value,
  hint,
  trend,
  trendPositive = true,
  icon: Icon,
  iconClassName,
  valueClassName,
  children,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  trend?: string;
  trendPositive?: boolean;
  icon?: LucideIcon;
  iconClassName?: string;
  valueClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn(rep.card, "p-4")}>
      <div className="flex items-start justify-between gap-2">
        <p className={rep.label}>{label}</p>
        {Icon ? (
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#137752]",
              iconClassName
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className={cn("mt-2 text-[26px] font-bold leading-none tracking-tight text-[#101828]", valueClassName)}>
        {value}
      </p>
      {trend || hint ? (
        <p className="mt-2 text-xs text-[#667085]">
          {trend ? (
            <span className={cn("mr-1 font-semibold", trendPositive ? "text-[#027A48]" : "text-[#B42318]")}>
              {trend}
            </span>
          ) : null}
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function RepSearch({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-[200px] flex-1", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(rep.input, "pl-9")}
      />
    </div>
  );
}

export function RepViewLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={rep.link}>
      {children}
    </Link>
  );
}

export function RepBadge({
  children,
  tone = "green",
}: {
  children: React.ReactNode;
  tone?: "green" | "blue" | "amber" | "red" | "gray" | "purple";
}) {
  const styles = {
    green: "bg-[#ECFDF3] text-[#027A48]",
    blue: "bg-[#EFF8FF] text-[#175CD3]",
    amber: "bg-[#FFFAEB] text-[#B54708]",
    red: "bg-[#FEF3F2] text-[#B42318]",
    gray: "bg-[#F2F4F7] text-[#475467]",
    purple: "bg-[#F4F3FF] text-[#5925DC]",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", styles[tone])}>
      {children}
    </span>
  );
}
