"use client";

import type { ReactNode } from "react";
import { FileText, Loader2, Plus, Zap } from "lucide-react";
import type { MomentumLabel } from "@/lib/reviews/metrics";
import { PageHeader } from "@/newui-transplant/components/app/kit";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { Button } from "@/newui-transplant/components/ui/button";
import { cn } from "@/lib/utils";

export function formatPace(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function formatChartDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const momentumCardClass = cn(OPUS_CARD, "bg-card p-4");

export function MomentumPageHeader() {
  return (
    <PageHeader
      title="Review Momentum™"
      description="Review velocity vs competitors across the last 7 days, 1 month, and 3 months (90 days). Charts and comparison use the same windows — recent pace first, then 30- and 90-day trends."
    />
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
      <Button type="button" onClick={onRun} disabled={running}>
        {running ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5 fill-current" />}
        Run Momentum Audit
      </Button>
      {businessId ? (
        <>
          <Button variant="ghost" size="sm" asChild>
            <a href={`/businesses/${businessId}/review-requests`}>
              <FileText className="size-3.5" />
              Open Previous Reports
            </a>
          </Button>
          <Button variant="outline" size="sm" type="button">
            <Plus className="size-3.5" />
            Add competitor
          </Button>
        </>
      ) : null}
    </div>
  );
}

export function momentumTableHeadClass(extra?: string) {
  return cn(
    "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground",
    extra,
  );
}

export function momentumTableBadge(label: MomentumLabel): string {
  const tone: Record<MomentumLabel, string> = {
    Exploding: "bg-primary/10 text-primary ring-primary/20",
    Accelerating: "bg-success/10 text-success ring-success/25",
    Healthy: "bg-chart-2/12 text-chart-2 ring-chart-2/30",
    Recovering: "bg-warning/15 text-warning ring-warning/30",
    Stalled: "bg-muted text-muted-foreground ring-border",
    Declining: "bg-destructive/10 text-destructive ring-destructive/20",
  };
  return cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", tone[label]);
}

export function MomentumMetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className={momentumCardClass}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function MomentumPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(momentumCardClass, className)}>{children}</div>;
}

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
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function MomentumTableShell({
  title,
  subtitle,
  children,
  action,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  if (!title) {
    return <section className={cn(OPUS_CARD, "overflow-hidden bg-card")}>{children}</section>;
  }
  return (
    <section className={cn(OPUS_CARD, "overflow-hidden bg-card")}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}
