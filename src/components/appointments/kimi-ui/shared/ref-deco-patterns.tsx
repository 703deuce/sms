"use client";

import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import "../overview/reference.css";

export type RefDecoStatusTone = "active" | "ready" | "paused" | "attention" | "suppressed";

const STATUS_CLASS: Record<RefDecoStatusTone, string> = {
  active: "ref-deco-status--active",
  ready: "ref-deco-status--ready",
  paused: "ref-deco-status--paused",
  attention: "ref-deco-status--attention",
  suppressed: "ref-deco-status--suppressed",
};

export function RefDecoStatusBadge({
  tone,
  label,
  showDot = true,
}: {
  tone: RefDecoStatusTone;
  label: string;
  showDot?: boolean;
}) {
  return (
    <span className={cn("ref-deco-status", STATUS_CLASS[tone])}>
      {showDot ? <span className="ref-deco-status-dot" aria-hidden /> : null}
      {label}
    </span>
  );
}

export function RefDecoIconRing({
  icon: Icon,
  tint = "purple",
  size = 48,
}: {
  icon: LucideIcon;
  tint?: "purple" | "green" | "blue" | "amber" | "red";
  size?: number;
}) {
  return (
    <div
      className={cn("ref-deco-icon-ring", `ref-deco-icon-ring--${tint}`)}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.42)} strokeWidth={2} aria-hidden />
    </div>
  );
}

export function RefDecoSectionHeading({
  title,
  description,
  action,
  accent = "purple",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  accent?: "purple" | "blue" | "green" | "amber";
}) {
  return (
    <div className="ref-deco-section-head">
      <div className="flex min-w-0 items-start gap-3">
        <span className={cn("ref-deco-section-accent", `ref-deco-section-accent--${accent}`)} aria-hidden />
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold tracking-tight text-gray-900">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function RefDecoSection({
  title,
  description,
  accent = "purple",
  tint,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  accent?: "purple" | "blue" | "green" | "amber";
  tint?: "purple" | "blue" | "amber";
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "ref-deco-section",
        tint === "purple" && "ref-deco-section--tint-purple",
        tint === "blue" && "ref-deco-section--tint-blue",
        tint === "amber" && "ref-deco-section--tint-amber",
        className,
      )}
    >
      {title ? (
        <RefDecoSectionHeading title={title} description={description} action={action} accent={accent} />
      ) : null}
      <div className={cn(title ? "ref-deco-section-body" : "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function RefDecoEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="ref-deco-empty">
      <div className="ref-deco-empty-icon">
        <Icon size={26} strokeWidth={1.75} aria-hidden />
      </div>
      <p className="text-[15px] font-semibold text-gray-900">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-gray-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function RefDecoPageHeader({
  title,
  description,
  badge,
  action,
}: {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="ref-deco-page-head flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-[26px] font-bold tracking-tight text-gray-900">{title}</h1>
          {badge}
        </div>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-gray-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function RefDecoWizardProgress({
  steps,
  labels,
  currentIndex,
}: {
  steps: string[];
  labels: Record<string, string>;
  currentIndex: number;
}) {
  return (
    <nav aria-label="Setup progress" className="ref-deco-section ref-deco-section--tint-purple overflow-x-auto p-4">
      <ol className="flex min-w-max items-center gap-1">
        {steps.map((s, i) => {
          const done = i < currentIndex;
          const current = i === currentIndex;
          return (
            <li key={s} className="flex items-center">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  current
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : done
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-gray-50 text-gray-500",
                )}
                aria-current={current ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                    current
                      ? "bg-white/20 text-white"
                      : done
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-200 text-gray-600",
                  )}
                  aria-hidden
                >
                  {done ? "✓" : i + 1}
                </span>
                <span className="whitespace-nowrap">{labels[s] || s}</span>
              </div>
              {i < steps.length - 1 ? (
                <span
                  className={cn("mx-1 h-px w-4 shrink-0", done ? "bg-emerald-300" : "bg-gray-200")}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function RefDecoHeroNumber({
  label,
  number,
  hint,
  tint = "purple",
}: {
  label: string;
  number: string;
  hint?: string;
  tint?: "purple" | "blue" | "green";
}) {
  const gradient =
    tint === "blue"
      ? "from-sky-50 via-white to-[#dcefeb]/80 border-sky-100"
      : tint === "green"
        ? "from-emerald-50 via-white to-teal-50/80 border-emerald-100"
        : "from-[#dcefeb] via-white to-[#dcefeb]/80 border-[#147d74]/20";
  return (
    <div className={cn("rounded-2xl border bg-gradient-to-br p-6 text-center shadow-sm", gradient)}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-2 font-display text-[32px] font-bold tracking-tight text-primary sm:text-4xl">
        {number}
      </p>
      {hint ? <p className="mt-2 text-[12px] leading-relaxed text-gray-600">{hint}</p> : null}
    </div>
  );
}

export function RefDecoCheckpointList({
  items,
  title,
}: {
  title?: string;
  items: Array<{ done: boolean; label: string }>;
}) {
  return (
    <div className="ref-deco-progress-panel">
      {title ? (
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      ) : null}
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2.5 text-[13px]">
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-gray-300" aria-hidden />
            )}
            <span className={item.done ? "font-medium text-gray-900" : "text-gray-500"}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RefDecoCallout({
  icon: Icon,
  title,
  children,
  variant = "info",
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  variant?: "info" | "warning" | "success";
}) {
  const styles =
    variant === "warning"
      ? { wrap: "border-amber-200 bg-gradient-to-r from-amber-50/90 to-orange-50/50", tile: "tile-amber" as const }
      : variant === "success"
        ? { wrap: "border-emerald-200 bg-gradient-to-r from-emerald-50/90 to-teal-50/40", tile: "tile-green" as const }
        : { wrap: "border-[#147d74]/20 bg-gradient-to-r from-[#dcefeb]/80 to-[#dcefeb]/40", tile: "tile-purple" as const };
  return (
    <div className={cn("ref-card flex items-start gap-3 border p-4", styles.wrap)}>
      <div className={`icon-tile ${styles.tile}`}>
        <Icon size={20} strokeWidth={2} aria-hidden />
      </div>
      <div className="min-w-0 text-[13px]">
        <p className="font-semibold text-gray-900">{title}</p>
        <div className="mt-1 leading-relaxed text-gray-700">{children}</div>
      </div>
    </div>
  );
}

export function RefDecoOptionCard({
  selected,
  disabled,
  title,
  description,
  badge,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  description: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left transition-all",
        selected
          ? "border-primary bg-primary/[0.04] shadow-[0_4px_14px_rgba(20,125,116,0.12)] ring-2 ring-primary/20"
          : "border-gray-200 bg-white hover:border-[#147d74]/30 hover:shadow-sm",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <p className="text-[14px] font-semibold text-gray-900">
        {title}
        {badge ? <span className="ref-pill pill-purple ml-2 align-middle">{badge}</span> : null}
      </p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-600">{description}</p>
    </button>
  );
}

export function RefDecoSectionPanel({
  title,
  description,
  children,
  className,
  tint,
  accent = "purple",
  action,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  tint?: "purple" | "blue" | "amber";
  accent?: "purple" | "blue" | "green" | "amber";
  action?: React.ReactNode;
}) {
  return (
    <RefDecoSection
      title={title}
      description={description}
      tint={tint}
      accent={accent}
      action={action}
      className={className}
    >
      {children}
    </RefDecoSection>
  );
}

export function RefDecoPrimaryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_rgba(79,70,229,0.25)] transition hover:bg-primary/90 hover:shadow-[0_6px_18px_rgba(79,70,229,0.3)]"
    >
      {children}
    </Link>
  );
}

const KPI_TINT: Record<string, string> = {
  purple: "ref-deco-kpi--purple",
  blue: "ref-deco-kpi--blue",
  green: "ref-deco-kpi--green",
  amber: "ref-deco-kpi--amber",
  red: "ref-deco-kpi--red",
};

export function RefDecoStatCards({
  stats,
}: {
  stats: Array<{
    label: string;
    value: string | number;
    sub?: string;
    icon: LucideIcon;
    tint?: string;
    highlight?: boolean;
    subClassName?: string;
  }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((s) => {
        const Icon = s.icon;
        const tintKey = s.tint || "purple";
        return (
          <div
            key={s.label}
            className={cn(
              "ref-deco-kpi flex items-center gap-4 px-5 py-5",
              KPI_TINT[tintKey] || KPI_TINT.purple,
              s.highlight && "ref-deco-kpi--highlight",
            )}
          >
            <RefDecoIconRing icon={Icon} tint={tintKey as "purple" | "green" | "blue" | "amber" | "red"} size={44} />
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-gray-500">{s.label}</div>
              <div className="text-[22px] font-bold leading-tight text-gray-900">{s.value}</div>
              {s.sub ? (
                <div className={cn("mt-0.5 text-[12px]", s.subClassName || "text-gray-400")}>{s.sub}</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
