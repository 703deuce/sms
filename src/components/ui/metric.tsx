import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

export function Sparkline({
  points,
  color = "#10b981",
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
  tone = "bg-emerald-50 text-emerald-600",
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
    <div className={cn("surface rounded-[12px] bg-card p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-[22px] font-bold tracking-tight text-foreground">{value}</p>
          {hint ? <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          {Icon ? (
            <span className={cn("flex h-10 w-10 items-center justify-center rounded-[10px]", tone)}>
              <Icon className="h-5 w-5" />
            </span>
          ) : null}
          {sparkline ? <Sparkline points={sparkline} color={sparkColor} /> : null}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block transition hover:-translate-y-0.5 hover:shadow-md">
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
  iconTone = "bg-emerald-50 text-emerald-600",
  actions,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconTone?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className={cn("mt-0.5 flex h-10 w-10 items-center justify-center rounded-[10px]", iconTone)}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-foreground">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
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
      <h2 className="text-[14px] font-bold text-foreground">{title}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="h-9 w-full min-w-[200px] rounded-[10px] border border-border bg-card px-3 text-[13px] outline-none focus:border-primary sm:w-56"
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
      <span>{rangeLabel}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted"
          aria-label="Previous page"
        >
          ‹
        </button>
        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-primary text-[12px] font-semibold text-primary">
          1
        </span>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted"
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  );
}
