/**
 * Ported from newui/components/app/kit.tsx for Category A/B route integration (Stage 2+).
 * Presentation only — no data fetching.
 */
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function NewUiPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main className={cn("mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8", className)}>{children}</main>
  );
}

export function NewUiPageHeader({
  title,
  description,
  actions,
  status,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  status?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-balance text-2xl font-semibold tracking-tight">{title}</h1>
          {status}
        </div>
        {description ? <p className="mt-1 text-pretty text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function NewUiPanel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-xs", className)}>
      {title ? (
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{title}</h2>
            {description ? <p className="mt-0.5 text-pretty text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function NewUiPill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const tones = {
    default: "bg-muted text-muted-foreground",
    success: "bg-emerald-500/10 text-emerald-700",
    warning: "bg-amber-500/10 text-amber-800",
    danger: "bg-destructive/10 text-destructive",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function NewUiTextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-0.5 text-sm font-medium text-primary hover:underline">
      {children}
      <ChevronRight className="size-3.5" aria-hidden />
    </Link>
  );
}

export function NewUiStat({
  label,
  value,
  delta,
  hint,
  href,
}: {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {delta != null ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {delta >= 0 ? <ArrowUpRight className="size-3 text-emerald-600" /> : <ArrowDownRight className="size-3 text-destructive" />}
          {Math.abs(delta)}%
        </p>
      ) : null}
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
  if (href) return <Link href={href} className="block transition hover:opacity-90">{inner}</Link>;
  return inner;
}
