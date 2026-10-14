"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Calendar, Download, Filter, Info, Search } from "lucide-react";
import { Button, buttonVariants } from "@/newui-transplant/components/ui/button";
import {
  PageHeader,
  Pill,
  Stat,
  TextLink,
  type Tone,
} from "@/newui-transplant/components/app/kit";
import { OPUS_CARD, OPUS_SEARCH_INPUT } from "@/newui-transplant/components/app/opus-surfaces";
import { OpusLineTabs } from "@/newui-transplant/components/app/segmented-nav";
import { cn } from "@/lib/utils";

/** @deprecated Use semantic tokens — kept for import compatibility during Reviews Opus migration. */
export const REP_GREEN = "var(--primary)";
export const REP_GREEN_SOFT = "color-mix(in oklch, var(--primary) 12%, transparent)";

export const repBtnPrimary = cn(buttonVariants({ variant: "default" }));
export const repBtnSecondary = cn(buttonVariants({ variant: "outline" }));
export const repBtnGhost = cn(buttonVariants({ variant: "ghost" }));

export const rep = {
  page: "flex flex-col gap-4",
  card: OPUS_CARD,
  cardPad: cn(OPUS_CARD, "p-4"),
  title: "text-2xl font-semibold tracking-tight text-foreground",
  subtitle: "text-sm text-muted-foreground",
  label: "text-xs font-medium uppercase tracking-wide text-muted-foreground",
  btnPrimary: repBtnPrimary,
  btnSecondary: repBtnSecondary,
  link: "inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline",
  input: OPUS_SEARCH_INPUT,
  select: OPUS_SEARCH_INPUT,
  tabActive: "text-foreground",
  tabIdle: "text-muted-foreground hover:text-foreground",
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
    <PageHeader
      title={title}
      description={subtitle}
      meta={
        <span className="inline-flex items-center gap-1 text-muted-foreground" title="Date range">
          <Info className="size-3.5 shrink-0" aria-hidden />
        </span>
      }
      actions={
        <>
          {actions}
          <Button type="button" variant="outline" size="sm" className="pointer-events-none" tabIndex={-1}>
            <Calendar className="size-4" aria-hidden />
            {dateRangeLabel}
          </Button>
          {showCompare ? (
            <Button type="button" variant="outline" size="sm" disabled title="Coming soon">
              Compare
            </Button>
          ) : null}
          {showExport ? (
            <Button type="button" variant="outline" size="sm" disabled title="Coming soon">
              <Download className="size-4" aria-hidden />
              Export
            </Button>
          ) : null}
          {showFilters ? (
            <Button type="button" size="sm" disabled title="Use filters below">
              <Filter className="size-4" aria-hidden />
              {filterLabel}
            </Button>
          ) : null}
          {primaryAction}
        </>
      }
    />
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
    <OpusLineTabs
      label="Section tabs"
      tabs={tabs.map((t) => ({ value: t.id, label: t.label }))}
      value={active}
      onChange={onChange}
    />
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
  const delta =
    trend && /^[+-]?\d/.test(trend)
      ? parseFloat(trend.replace(/[^\d.-]/g, "")) * (trendPositive ? 1 : -1)
      : undefined;

  const statValue = typeof value === "string" || typeof value === "number" ? String(value) : "—";

  if (typeof value !== "string" && typeof value !== "number") {
    return (
      <section className={cn(OPUS_CARD, "p-4")}>
        <div className="flex items-start justify-between gap-2">
          <p className={rep.label}>{label}</p>
          {Icon ? (
            <span className={cn("flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary", iconClassName)}>
              <Icon className="size-4" aria-hidden />
            </span>
          ) : null}
        </div>
        <div className={cn("mt-2 text-2xl font-semibold tabular-nums tracking-tight", valueClassName)}>{value}</div>
        {trend || hint ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {trend ? (
              <span className={cn("mr-1 font-medium", trendPositive ? "text-success" : "text-destructive")}>{trend}</span>
            ) : null}
            {hint}
          </p>
        ) : null}
        {children}
      </section>
    );
  }

  return (
    <div className="relative">
      <Stat label={label} value={statValue} delta={delta} hint={typeof hint === "string" ? hint : undefined} icon={Icon} />
      {children ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  );
}

export function RepSearch({
  value,
  onChange,
  placeholder = "Search…",
  className,
  id = "rep-search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("relative min-w-[200px] flex-1", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <label htmlFor={id} className="sr-only">Search</label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(OPUS_SEARCH_INPUT, "pl-9")}
      />
    </div>
  );
}

export function RepViewLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <TextLink href={href}>{children}</TextLink>;
}

const badgeTone: Record<string, Tone> = {
  green: "success",
  blue: "info",
  amber: "warning",
  red: "danger",
  gray: "neutral",
  purple: "primary",
};

export function RepBadge({
  children,
  tone = "green",
}: {
  children: React.ReactNode;
  tone?: "green" | "blue" | "amber" | "red" | "gray" | "purple";
}) {
  return <Pill tone={badgeTone[tone] ?? "neutral"}>{children}</Pill>;
}
