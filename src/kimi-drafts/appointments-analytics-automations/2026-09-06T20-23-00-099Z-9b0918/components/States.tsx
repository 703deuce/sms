"use client";

import { AlertTriangle, Inbox, RefreshCcw } from "lucide-react";
import { Card } from "./MetricCard";

export function MetricSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
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

export function TableSkeleton() {
  return (
    <Card className="p-0">
      <div className="border-b border-border px-5 py-4">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-3 px-5 py-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  icon,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-primary">
        {icon ?? <Inbox size={20} />}
      </div>
      <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
        {description}
      </p>
      {actionLabel ? (
        actionHref ? (
          <a
            href={actionHref}
            className="mt-5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold"
            style={{ color: "#fff" }}
          >
            {actionLabel}
          </a>
        ) : (
          <button
            onClick={onAction}
            className="mt-5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold"
            style={{ color: "#fff", border: "none", cursor: "pointer" }}
          >
            {actionLabel}
          </button>
        )
      ) : null}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <div
        className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ background: "#fef2f2", color: "#dc2626" }}
      >
        <AlertTriangle size={20} />
      </div>
      <h3 className="font-display text-sm font-semibold text-foreground">
        Automation analytics couldn’t be loaded
      </h3>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
        Workflow and reminder delivery metrics aren’t available right now. Your automations
        are unaffected — this only affects reporting.
      </p>
      <button
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-[13px] font-semibold text-foreground"
        style={{ cursor: "pointer" }}
      >
        <RefreshCcw size={14} /> Retry
      </button>
    </div>
  );
}
