import { LucideIcon } from "lucide-react";
import { Card, cn } from "./ui";

export type MetricDef = {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: string;
  hint?: string;
};

export function MetricCard({ metric }: { metric: MetricDef }) {
  const Icon = metric.icon;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {metric.label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">
            {metric.value}
          </p>
          {metric.hint ? (
            <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            metric.tone,
          )}
        >
          <Icon className="h-4.5 w-4.5" size={18} strokeWidth={2} />
        </div>
      </div>
    </Card>
  );
}

export function MetricSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="w-full space-y-2.5">
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="h-7 w-14 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-9 w-9 animate-pulse rounded-lg bg-muted" />
          </div>
        </Card>
      ))}
    </div>
  );
}
