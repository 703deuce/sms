"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "./AnalyticsShell";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("surface rounded-xl bg-card p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 font-display text-[22px] font-semibold tracking-tight text-foreground">
            {value}
          </p>
          {hint ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tone)}>
          <Icon size={17} strokeWidth={2} />
        </div>
      </div>
    </Card>
  );
}
