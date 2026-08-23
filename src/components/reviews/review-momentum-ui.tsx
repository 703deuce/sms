"use client";

import type { ReactNode } from "react";
import { FileText, Loader2, Plus, Zap } from "lucide-react";
import type { MomentumLabel } from "@/lib/reviews/metrics";
import { mock } from "@/components/mockup/ui";
import { cn } from "@/lib/utils";

export function formatPace(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function formatChartDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MomentumPageHeader() {
  return (
    <div className="min-w-0">
      <h1 className={mock.title}>Review Momentum™</h1>
      <p className={mock.subtitle}>
        Review velocity vs competitors across the last 7 days, 1 month, and 3 months (90 days).
      </p>
      <p className="mt-1 text-sm text-[#667085]">
        Charts and comparison use the same windows — recent pace first, then 30- and 90-day trends.
      </p>
    </div>
  );
}

export function MomentumTopBar({
  running,
  onRun,
  businessId,
}: {
  running: boolean;
  onRun: () => void;
  businessId?: string;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <button type="button" onClick={onRun} disabled={running} className={mock.btnPrimary}>
        {running ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Zap className="h-3.5 w-3.5 fill-current" />
        )}
        Run Momentum Audit
      </button>
      {businessId ? (
        <>
          <a href={`/businesses/${businessId}/review-requests`} className={mock.btnGhost}>
            <FileText className="h-3.5 w-3.5" />
            Open Previous Reports
          </a>
          <button
            type="button"
            className={mock.btnGhost}
            onClick={() => {
              void import("@/lib/journey/report-staging").then(({ stageReportItem }) => {
                stageReportItem({
                  businessId,
                  source: "reviews",
                  title: "Review momentum insight",
                  href: `/businesses/${businessId}/review-momentum`,
                });
              });
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add to report
          </button>
        </>
      ) : null}
    </div>
  );
}

export function momentumTableBadge(label: MomentumLabel): string {
  switch (label) {
    case "Accelerating":
    case "Exploding":
      return "rounded-full bg-[#137752] px-2.5 py-0.5 text-[11px] font-semibold text-white";
    case "Healthy":
    case "Stable":
      return "rounded-full bg-[#ECFDF3] px-2.5 py-0.5 text-[11px] font-semibold text-[#027A48] ring-1 ring-[#A6F4C5]";
    case "Slowing":
    case "Dormant":
      return "rounded-full bg-[#F2F4F7] px-2.5 py-0.5 text-[11px] font-semibold text-[#667085]";
    default:
      return "rounded-full bg-[#F2F4F7] px-2.5 py-0.5 text-[11px] font-semibold text-[#667085]";
  }
}

export const momentumCardClass = mock.card;

export function MomentumSectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight text-[#101828]">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs leading-snug text-[#667085]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function MomentumPanel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(mock.card, "p-4", className)}>{children}</div>;
}

export function MomentumTableShell({ children }: { children: ReactNode }) {
  return (
    <div className={cn(mock.card, "overflow-hidden p-0")}>
      <div className="border-b border-[#E6EAF0] px-4 py-3">
        <h3 className="text-[15px] font-semibold text-[#101828]">Competitor comparison</h3>
      </div>
      {children}
    </div>
  );
}

export function momentumTableHeadClass() {
  return cn(mock.tableHead, "px-4 py-3 font-semibold");
}

export function MomentumMetricCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
}) {
  const valueIsLongString =
    typeof value === "string" && value.length > 12;
  return (
    <div className={cn(mock.card, "p-4")}>
      <div className="flex items-start justify-between gap-2">
        <p className={mock.label}>{label}</p>
        {icon}
      </div>
      <p
        className={cn(
          "mt-2 font-bold leading-tight tracking-tight text-[#101828]",
          valueIsLongString ? "text-[18px]" : "text-[26px] leading-none"
        )}
      >
        {value}
      </p>
      {sub ? <div className="mt-2 text-xs text-[#667085]">{sub}</div> : null}
    </div>
  );
}
