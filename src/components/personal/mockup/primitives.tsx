"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export const pm = {
  card: "rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
  muted: "text-[13px] text-[#6b7280]",
  title: "text-[22px] font-bold tracking-tight text-[#111827]",
  subtitle: "mt-1 text-[14px] text-[#6b7280]",
  primary: "#6366f1",
};

export function PersonalMockPage({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1400px]">
      <div className={cn(right ? "grid gap-6 xl:grid-cols-[1fr_320px]" : "")}>
        <div className="min-w-0 space-y-6">{children}</div>
        {right ? <aside className="space-y-4">{right}</aside> : null}
      </div>
    </div>
  );
}

export function PersonalMockHeader({
  title,
  description,
  actions,
  filters,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  filters?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={pm.title}>{title}</h1>
          {description ? <p className={pm.subtitle}>{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}
    </div>
  );
}

export function PersonalMockKpi({
  label,
  value,
  sub,
  icon: Icon,
  iconClass = "bg-[#eef2ff] text-[#6366f1]",
  trend,
  trendLabel,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  iconClass?: string;
  trend?: number;
  trendLabel?: string;
}) {
  return (
    <div className={cn(pm.card, "p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[#6b7280]">{label}</p>
          <p className="mt-1 text-[26px] font-bold leading-none text-[#111827]">{value}</p>
          {sub ? <p className="mt-1 text-[11px] text-[#9ca3af]">{sub}</p> : null}
          {trend != null ? (
            <p
              className={cn(
                "mt-1 text-[11px] font-semibold",
                trend >= 0 ? "text-[#059669]" : "text-[#dc2626]",
              )}
            >
              {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% {trendLabel || "vs previous"}
            </p>
          ) : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              iconClass,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PersonalMockSection({
  title,
  description,
  children,
  action,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(pm.card, "overflow-hidden", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f3f4f6] px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[#111827]">{title}</h2>
          {description ? <p className="mt-0.5 text-[12px] text-[#6b7280]">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function PersonalMockPill({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "green" | "orange" | "purple" | "red" | "gray";
}) {
  const tones = {
    blue: "bg-[#eef2ff] text-[#4338ca]",
    green: "bg-[#ecfdf5] text-[#059669]",
    orange: "bg-[#fff7ed] text-[#ea580c]",
    purple: "bg-[#f5f3ff] text-[#7c3aed]",
    red: "bg-[#fef2f2] text-[#dc2626]",
    gray: "bg-[#f3f4f6] text-[#6b7280]",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function PersonalMockSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-9 rounded-lg border border-[#e5e7eb] bg-white px-3 text-[13px] text-[#374151] outline-none focus:border-[#6366f1]",
        className,
      )}
      {...props}
    />
  );
}

export function PersonalMockInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 text-[13px] outline-none focus:border-[#6366f1]",
        className,
      )}
      {...props}
    />
  );
}

export function PersonalMockBtn({
  variant = "primary",
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { variant?: "primary" | "outline" | "ghost" }) {
  const variants = {
    primary:
      "bg-[#6366f1] text-white hover:bg-[#5558e8] shadow-sm",
    outline: "border border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f9fafb]",
    ghost: "text-[#6366f1] hover:bg-[#eef2ff]",
  };
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function PersonalMockTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string; icon?: LucideIcon }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-6 border-b border-[#e5e7eb]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-2 border-b-2 pb-3 text-[14px] font-semibold transition",
              isActive
                ? "border-[#6366f1] text-[#6366f1]"
                : "border-transparent text-[#6b7280] hover:text-[#111827]",
            )}
          >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function PersonalMockFilterChips({
  options,
  active,
  onChange,
}: {
  options: string[];
  active: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-[12px] font-semibold",
            active === opt
              ? "bg-[#eef2ff] text-[#6366f1]"
              : "bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function PersonalMockPagination({
  showing,
  total,
  page = 1,
  pages = 1,
}: {
  showing: string;
  total: number;
  page?: number;
  pages?: number;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-[#6b7280]">
      <span>{showing}</span>
      <div className="flex items-center gap-2">
        <button type="button" className="rounded-md border border-[#e5e7eb] px-2 py-1 hover:bg-[#f9fafb]">
          ‹
        </button>
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            type="button"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md text-[12px] font-semibold",
              p === page ? "bg-[#6366f1] text-white" : "border border-[#e5e7eb] hover:bg-[#f9fafb]",
            )}
          >
            {p}
          </button>
        ))}
        <button type="button" className="rounded-md border border-[#e5e7eb] px-2 py-1 hover:bg-[#f9fafb]">
          ›
        </button>
        <PersonalMockSelect className="h-8 w-[90px] text-[12px]">
          <option>10 / page</option>
          <option>25 / page</option>
        </PersonalMockSelect>
      </div>
    </div>
  );
}

export function PersonalMockAsideCard({
  title,
  icon: Icon,
  children,
  tone = "default",
}: {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  tone?: "default" | "warning" | "info";
}) {
  const tones = {
    default: "border-[#e5e7eb]",
    warning: "border-[#fed7aa] bg-[#fffbeb]",
    info: "border-[#c7d2fe] bg-[#eef2ff]",
  };
  return (
    <div className={cn(pm.card, "p-4", tones[tone])}>
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-[#6366f1]" /> : null}
        <h3 className="text-[13px] font-semibold text-[#111827]">{title}</h3>
      </div>
      <div className="mt-3 space-y-2 text-[12px] text-[#6b7280]">{children}</div>
    </div>
  );
}

export function PersonalMockToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-[13px]">
      <span className="text-[#374151]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 rounded-full transition",
          checked ? "bg-[#6366f1]" : "bg-[#d1d5db]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </label>
  );
}
