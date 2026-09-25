import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type TransovoKpiItem = {
  label: string;
  value: string;
  trendPct?: number | null;
  icon?: LucideIcon;
  iconClassName?: string;
};

function Trend({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return null;
  const label = pct >= 0 ? `+${pct}% vs last 7 days` : `${pct}% vs last 7 days`;
  return <span className="transovo-kpi-card__trend">{label}</span>;
}

export function TransovoKpiStrip({
  items,
  columns = 4,
  className,
}: {
  items: TransovoKpiItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const colClass =
    columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "transovo-kpi-strip--four";

  return (
    <div className={cn("transovo-kpi-strip", colClass, className)} role="list">
      {items.map((item) => (
        <div key={item.label} className="transovo-kpi-card" role="listitem">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="transovo-kpi-card__value">{item.value}</p>
              <p className="transovo-kpi-card__label">{item.label}</p>
              <Trend pct={item.trendPct} />
            </div>
            {item.icon ? (
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--transovo-brand-soft)]",
                  item.iconClassName,
                )}
                aria-hidden
              >
                <item.icon className="h-4 w-4 text-[var(--transovo-brand)]" strokeWidth={2} />
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TransovoStatePanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("transovo-state-panel", className)}>{children}</div>;
}
