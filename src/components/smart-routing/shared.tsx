"use client";

import { cn } from "@/lib/utils";
import { ArrowLeft, Info, TrendingDown, TrendingUp } from "lucide-react";
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
    <div className={cn("mx-auto max-w-[1320px] space-y-6 p-6 lg:p-8", className)}>
      {children}
    </div>
  );
}

/** Wireframe metric card: icon + label row, big value, green trend line */
export function SrMetricCard({
  label,
  value,
  icon,
  trend,
  trendLabel = "vs last week",
  iconClass,
  trendPositiveIsGood = true,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  trend?: number | null;
  trendLabel?: string;
  iconClass?: string;
  /** When false, negative trend is shown in green (e.g. failures down) */
  trendPositiveIsGood?: boolean;
}) {
  const showTrend = trend != null;
  const trendGood =
    trend != null && (trendPositiveIsGood ? trend >= 0 : trend <= 0);

  return (
    <div className={cn(srCard, "p-5")}>
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            iconClass ?? "bg-[#eef2ff] text-[#6366f1]",
          )}
        >
          {icon}
        </div>
      </div>
      <p className="mt-4 text-[13px] font-medium text-[#6b7280]">{label}</p>
      <p className="mt-1 text-[32px] font-bold leading-none tracking-tight text-[#111827]">
        {value}
      </p>
      {showTrend ? (
        <p
          className={cn(
            "mt-2 inline-flex items-center gap-1 text-[12px] font-semibold",
            trendGood ? "text-emerald-600" : "text-red-600",
          )}
        >
          {trend >= 0 ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% {trendLabel}
        </p>
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
    paused: "bg-slate-100 text-slate-600 ring-slate-200",
    testing: "bg-sky-50 text-sky-700 ring-sky-200",
    needs_attention: "bg-red-50 text-red-700 ring-red-200",
    needs_review: "bg-orange-50 text-orange-800 ring-orange-200",
    connected: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    voicemail: "bg-violet-50 text-violet-700 ring-violet-200",
    text_requested: "bg-sky-50 text-sky-700 ring-sky-200",
    ai_handoff: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    passed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    ready: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    enabled: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
  const labels: Record<string, string> = {
    ai_handoff: "AI Handoff",
    text_requested: "Text Requested",
    needs_review: "Needs Review",
    needs_attention: "Needs Attention",
  };
  const label = labels[normalized] ?? status.replace(/_/g, " ");
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

export function SrSourcePill({ sourceType }: { sourceType: string }) {
  const map: Record<string, string> = {
    elevenlabs: "bg-violet-50 text-violet-700 ring-violet-200",
    recording: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    upload: "bg-sky-50 text-sky-700 ring-sky-200",
    telnyx_tts: "bg-orange-50 text-orange-800 ring-orange-200",
  };
  const labels: Record<string, string> = {
    elevenlabs: "AI Generated",
    recording: "Recorded in Transovo",
    upload: "Uploaded Recording",
    telnyx_tts: "Telnyx TTS Draft",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
        map[sourceType] ?? "bg-slate-100 text-slate-600 ring-slate-200",
      )}
    >
      {labels[sourceType] ?? sourceType}
    </span>
  );
}

export function SrSectionCard({
  number,
  title,
  children,
  className,
  action,
  icon,
}: {
  number?: number;
  title: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className={cn(srCard, "p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {number != null ? (
            <span className="text-[14px] font-bold text-[#111827]">{number}.</span>
          ) : null}
          {icon}
          <h2 className="text-[15px] font-bold text-[#111827]">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function SrSectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <h2 className="text-[15px] font-bold text-[#111827]">{title}</h2>
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#9ca3af]" />
      {subtitle ? (
        <p className="mt-0.5 text-[12px] text-[#6b7280]">{subtitle}</p>
      ) : null}
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
        "inline-flex items-center justify-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)] hover:bg-[#4f46e5] disabled:opacity-50",
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
        "inline-flex items-center justify-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#374151] hover:bg-[#f9fafb] disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SrFlowSimulator({
  steps,
}: {
  steps: Array<{ label: string; variant?: "primary" | "default" | "warning" }>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-lg px-3 py-2 text-[11px] font-semibold",
              step.variant === "primary"
                ? "bg-[#eef2ff] text-[#6366f1]"
                : step.variant === "warning"
                  ? "bg-amber-50 text-amber-800"
                  : "border border-[#e5e7eb] bg-white text-[#374151]",
            )}
          >
            {step.label}
          </span>
          {i < steps.length - 1 ? (
            <span className="text-[#9ca3af]">→</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
