"use client";

import { cn } from "@/lib/utils";
import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export const srCard =
  "rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

export function SrBackLink({
  href = "/smart-routing",
  label = "Back to Smart Routing",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6b7280] hover:text-[#6366f1]"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

export function SrPageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-[1280px] space-y-6 p-6 lg:p-8", className)}>
      {children}
    </div>
  );
}

export function SrMetricCard({
  label,
  value,
  icon,
  trend,
  trendLabel,
  iconClass,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  trend?: number | null;
  trendLabel?: string;
  iconClass?: string;
}) {
  const up = trend != null && trend >= 0;
  return (
    <div className={cn(srCard, "p-5")}>
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            iconClass ?? "bg-[#eef2ff] text-[#6366f1]",
          )}
        >
          {icon}
        </div>
        {trend != null ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-semibold",
              up ? "text-emerald-600" : "text-red-600",
            )}
          >
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {up ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-[13px] font-medium text-[#6b7280]">{label}</p>
      <p className="mt-1 text-[28px] font-bold tracking-tight text-[#111827]">{value}</p>
      {trendLabel ? (
        <p className="mt-1 text-[11px] text-[#9ca3af]">{trendLabel}</p>
      ) : null}
    </div>
  );
}

export function SrStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const normalized = status.toLowerCase();
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    draft: "bg-amber-50 text-amber-800 ring-amber-200",
    paused: "bg-violet-50 text-violet-700 ring-violet-200",
    testing: "bg-sky-50 text-sky-700 ring-sky-200",
    needs_attention: "bg-red-50 text-red-700 ring-red-200",
    connected: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    voicemail: "bg-violet-50 text-violet-700 ring-violet-200",
    text_requested: "bg-sky-50 text-sky-700 ring-sky-200",
    ai_handoff: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    passed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    needs_review: "bg-amber-50 text-amber-800 ring-amber-200",
    ready: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    enabled: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
  const label = status.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset",
        styles[normalized] ?? "bg-slate-100 text-slate-700 ring-slate-200",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function SrSectionCard({
  number,
  title,
  children,
  className,
  action,
}: {
  number?: number;
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div className={cn(srCard, "p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {number != null ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#6366f1] text-[11px] font-bold text-white">
              {number}
            </span>
          ) : null}
          <h2 className="text-[15px] font-bold text-[#111827]">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function SrFieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[12px] font-semibold text-[#374151]">
      {children}
    </label>
  );
}

export function SrInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#111827] shadow-sm placeholder:text-[#9ca3af] focus:border-[#6366f1] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20",
        className,
      )}
      {...props}
    />
  );
}

export function SrSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#111827] shadow-sm focus:border-[#6366f1] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function SrTextarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#111827] shadow-sm placeholder:text-[#9ca3af] focus:border-[#6366f1] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20",
        className,
      )}
      {...props}
    />
  );
}

export function SrPrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(99,102,241,0.35)] hover:bg-[#4f46e5] disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SrOutlineButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-[13px] font-semibold text-[#374151] hover:bg-[#f9fafb] disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
