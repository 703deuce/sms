"use client";

import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { cn } from "@/lib/utils";

export type MomentumChartPoint = { label: string; value: number };

export function OverviewMomentumCard({
  title,
  subtitle,
  momentumLabel,
  chartData,
  className,
}: {
  title: string;
  subtitle?: string;
  momentumLabel?: string;
  chartData?: MomentumChartPoint[];
  className?: string;
}) {
  const points = chartData ?? [];
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className={cn(OPUS_CARD, "p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {momentumLabel ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {momentumLabel}
          </span>
        ) : null}
      </div>
      {points.length ? (
        <ul className="mt-4 flex h-24 items-end gap-1" aria-hidden>
          {points.map((p) => (
            <li
              key={p.label}
              className="flex-1 rounded-t bg-primary/70"
              style={{ height: `${Math.max(8, (p.value / max) * 100)}%` }}
              title={`${p.label}: ${p.value}`}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">No momentum data yet.</p>
      )}
    </div>
  );
}
