import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cardLabelClass, cardClass, StatValue } from "@/components/ui/design-system";
import { trendTextClass } from "@/lib/design/score-colors";
import { cn } from "@/lib/utils";

/** Canonical KPI surface — used by GridMetricCard and module-specific KPI variants. */
export const kpiCardSurface =
  "rounded-2xl border border-zinc-200/80 bg-white px-3.5 py-3.5 shadow-[0_8px_30px_rgba(15,23,42,0.06)]";

export const kpiLabelClass =
  "text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400";

export const kpiValueClass = "mt-0.5 text-base font-bold tabular-nums leading-none text-zinc-900";

export const kpiValuePrimaryClass =
  "mt-0.5 text-base font-bold tabular-nums leading-none text-zinc-900";

export const kpiSubClass = "mt-0.5 text-[11px] leading-snug text-zinc-500";

export const kpiIconWrapClass =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full";

const kpiRowCols: Record<3 | 4 | 5 | 6, string> = {
  3: "grid-cols-2 xl:grid-cols-3",
  4: "grid-cols-2 xl:grid-cols-4",
  5: "grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
};

/** Shared KPI row — same height, gap, and column rhythm on every module. */
export function KpiRow({
  children,
  cols = 4,
  className,
}: {
  children: ReactNode;
  cols?: 3 | 4 | 5 | 6;
  className?: string;
}) {
  return (
    <div className={cn("grid items-stretch gap-2", kpiRowCols[cols], className)}>{children}</div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  className?: string;
}

export function MetricCard({ label, value, sub, className }: MetricCardProps) {
  return (
    <div className={cn(cardClass, "p-3.5", className)}>
      <p className={cardLabelClass}>{label}</p>
      <div className="mt-1">
        <StatValue value={value} />
      </div>
      {sub ? <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{sub}</p> : null}
    </div>
  );
}

interface GridMetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  iconWrapClassName?: string;
  iconClassName?: string;
  trendPositive?: boolean;
  variant?: "primary" | "default";
  /** @deprecated Compact is now the product default; kept for call-site compatibility. */
  compact?: boolean;
  className?: string;
}

export function GridMetricCard({
  label,
  value,
  sub,
  icon: Icon,
  iconWrapClassName = "bg-emerald-50",
  iconClassName = "text-emerald-600",
  trendPositive,
  variant = "default",
  className,
}: GridMetricCardProps) {
  const isPrimary = variant === "primary";
  return (
    <div className={cn(kpiCardSurface, "flex h-full flex-col", className)}>
      <div className="flex items-start justify-between gap-1.5">
        <p className={kpiLabelClass}>{label}</p>
        {Icon ? (
          <span className={cn(kpiIconWrapClass, iconWrapClassName)}>
            <Icon className={cn("h-2.5 w-2.5", iconClassName)} />
          </span>
        ) : null}
      </div>
      <p className={isPrimary ? kpiValuePrimaryClass : kpiValueClass}>{value}</p>
      {sub ? (
        <p
          className={cn(
            kpiSubClass,
            trendPositive === true && "font-medium text-emerald-600",
            trendPositive === false && "font-medium text-red-600",
            trendPositive == null && "text-zinc-500"
          )}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}

interface GridTopCellsGroupProps {
  top3: number;
  top10: number;
  top20: number;
  total: number;
  top10Delta?: number | null;
  className?: string;
}

export function GridTopCellsGroup({
  top3,
  top10,
  top20,
  total,
  top10Delta,
  className,
}: GridTopCellsGroupProps) {
  return (
    <div
      className={cn(
        "flex divide-x divide-zinc-100 rounded-lg border border-zinc-200/80 bg-white px-1 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:px-1.5",
        className
      )}
    >
      {[
        { label: "Top 3", value: top3, sub: `of ${total}` },
        {
          label: "Top 10",
          value: top10,
          sub:
            top10Delta != null
              ? `${top10Delta >= 0 ? "+" : ""}${top10Delta} vs last`
              : undefined,
        },
        { label: "Top 20", value: top20, sub: "cells" },
      ].map((item) => (
        <div key={item.label} className="min-w-0 flex-1 px-2 text-center sm:px-3.5">
          <p className={cardLabelClass}>{item.label}</p>
          <p className="mt-0.5 text-base font-bold tabular-nums leading-none text-zinc-900">{item.value}</p>
          {item.sub && (
            <p
              className={cn(
                "mt-0.5 text-[11px]",
                item.label === "Top 10" && top10Delta != null
                  ? trendTextClass(top10Delta)
                  : "text-zinc-500"
              )}
            >
              {item.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

interface StatusBadgeProps {
  status: string;
}

const statusColors: Record<string, string> = {
  ready: "bg-emerald-100 text-emerald-800",
  rank_ready: "bg-sky-100 text-sky-800",
  enriching: "bg-amber-100 text-amber-800",
  scoring: "bg-amber-100 text-amber-800",
  ai_planning: "bg-violet-100 text-violet-800",
  partial: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  queued: "bg-amber-100 text-amber-800",
  dispatching: "bg-blue-100 text-blue-800",
  provider_running: "bg-blue-100 text-blue-800",
  normalizing: "bg-blue-100 text-blue-800",
  draft: "bg-zinc-100 text-zinc-700",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const label = status.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
        statusColors[status] ?? "bg-zinc-100 text-zinc-700"
      )}
    >
      {label}
    </span>
  );
}

interface BucketBadgeProps {
  bucket: string;
}

const bucketColors: Record<string, string> = {
  relevance: "bg-violet-100 text-violet-800",
  distance: "bg-sky-100 text-sky-800",
  prominence: "bg-orange-100 text-orange-800",
  trust: "bg-teal-100 text-teal-800",
};

export function BucketBadge({ bucket }: BucketBadgeProps) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize", bucketColors[bucket] ?? "")}>
      {bucket}
    </span>
  );
}
