import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

export function Sparkline({
  points,
  color = "#6366f1",
  width = 72,
  height = 28,
}: {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords}
      />
    </svg>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "bg-violet-50 text-violet-600",
  sparkline,
  sparkColor,
  href,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: string;
  sparkline?: number[];
  sparkColor?: string;
  href?: string;
  className?: string;
}) {
  const body = (
    <div className={cn("surface rounded-xl bg-card p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 font-display text-[22px] font-semibold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-[12px] tabular-nums text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          {Icon ? (
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg",
                tone,
              )}
            >
              <Icon className="h-4.5 w-4.5" />
            </span>
          ) : null}
          {sparkline ? <Sparkline points={sparkline} color={sparkColor} /> : null}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        className="block rounded-xl transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
      >
        {body}
      </a>
    );
  }
  return body;
}

export function SectionHeader({
  title,
  description,
  icon: Icon,
  iconTone = "bg-violet-50 text-violet-600",
  actions,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconTone?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon ? (
          <span
            className={cn(
              "mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg",
              iconTone,
            )}
          >
            <Icon className="h-4.5 w-4.5" />
          </span>
        ) : null}
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function TableToolbar({
  title,
  searchPlaceholder = "Search...",
  children,
}: {
  title: string;
  searchPlaceholder?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="font-display text-[13px] font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="h-9 w-full min-w-[200px] rounded-lg border border-border bg-card px-3 text-[13px] shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30 sm:w-56"
          placeholder={searchPlaceholder}
        />
        {children}
      </div>
    </div>
  );
}

export function PaginationBar({
  rangeLabel,
}: {
  rangeLabel: string;
}) {
  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3 text-[12px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <label className="inline-flex items-center gap-2">
        Show
        <select className="h-8 rounded-md border border-border bg-card px-2 text-[12px] outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30">
          <option>25</option>
          <option>50</option>
        </select>
        per page
      </label>
      <div className="flex items-center gap-2">
        <span className="tabular-nums">{rangeLabel}</span>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          ‹
        </button>
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-[12px] font-semibold text-primary-foreground">
          1
        </span>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          ›
        </button>
      </div>
    </div>
  );
}
