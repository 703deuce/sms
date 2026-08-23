"use client";

import type { ComponentType, ReactNode } from "react";
import { GridMetricCard, KpiRow } from "@/components/ui/metric-card";
import { cn } from "@/lib/utils";

export function ReviewRequestsKpiCard({
  label,
  value,
  sub,
  trend,
  trendLabel,
  icon: Icon,
  iconClass,
  invertTrendColor = false,
}: {
  label: string;
  value: string | number;
  sub?: ReactNode;
  trend?: string;
  trendLabel?: string;
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
  invertTrendColor?: boolean;
}) {
  const trendUp = trend?.startsWith("↑");
  const trendDown = trend?.startsWith("↓");
  const trendGood = invertTrendColor ? trendDown : trendUp;
  const trendBad = invertTrendColor ? trendUp : trendDown;

  const subParts: string[] = [];
  if (trend) subParts.push(trendLabel ? `${trend} ${trendLabel}` : trend);
  if (typeof sub === "string" && sub) subParts.push(sub);
  const composedSub = subParts.join(" · ") || undefined;

  const iconWrap = iconClass.includes("bg-")
    ? iconClass.split(" ").find((c) => c.startsWith("bg-")) ?? "bg-emerald-50"
    : "bg-emerald-50";
  const iconColor = iconClass.includes("text-")
    ? iconClass.split(" ").find((c) => c.startsWith("text-")) ?? "text-emerald-600"
    : "text-emerald-600";

  return (
    <GridMetricCard
      label={label}
      value={value}
      sub={composedSub}
      icon={Icon as never}
      iconWrapClassName={iconWrap}
      iconClassName={iconColor}
      trendPositive={trendGood ? true : trendBad ? false : undefined}
      className={cn(!composedSub && typeof sub !== "string" && sub ? "[&>p:last-child]:hidden" : undefined)}
    />
  );
}

export { KpiRow as ReviewRequestsKpiRow };

export function pctOfTotal(part: number, total: number): string {
  if (total <= 0) return "0% of total";
  return `${((part / total) * 100).toFixed(1)}% of total`;
}

export function responseRate(replies: number, sent: number): string {
  if (sent <= 0) return "0% response rate";
  return `${((replies / sent) * 100).toFixed(1)}% response rate`;
}

export function replyRate(replies: number, sent: number): string {
  if (sent <= 0) return "0% reply rate";
  return `${((replies / sent) * 100).toFixed(1)}% reply rate`;
}

export function failureRate(failed: number, total: number): string {
  if (total <= 0) return "0% failure rate";
  return `${((failed / total) * 100).toFixed(1)}% failure rate`;
}
