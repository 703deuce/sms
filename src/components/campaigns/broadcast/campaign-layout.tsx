"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Shared layout tokens aligned to the campaign blueprint composite. */
export const campaignUi = {
  page: "mx-auto max-w-[1200px]",
  title: "text-[26px] font-bold tracking-tight text-[#111827]",
  subtitle: "mt-1 text-[14px] text-[#6b7280]",
  card: "rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
  label: "text-[13px] font-semibold text-[#374151]",
  input:
    "h-10 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 text-[14px] text-[#111827] outline-none placeholder:text-[#9ca3af] focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]/30",
  textarea:
    "min-h-[140px] w-full resize-y rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5 text-[14px] text-[#111827] outline-none placeholder:text-[#9ca3af] focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]/30",
  primaryBtn:
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#6366f1] px-5 text-[14px] font-semibold text-white shadow-sm hover:bg-[#4f46e5] disabled:opacity-50",
  outlineBtn:
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-4 text-[14px] font-semibold text-[#374151] hover:bg-[#f9fafb] disabled:opacity-50",
  ghostBtn:
    "inline-flex h-9 items-center justify-center rounded-lg px-3 text-[13px] font-semibold text-[#6366f1] hover:bg-[#eef2ff]",
};

export function CampaignPageShell({
  title,
  subtitle,
  breadcrumb,
  actions,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className={campaignUi.page}>
      {breadcrumb ? (
        <nav className="mb-4 text-[13px] text-[#6b7280]">{breadcrumb}</nav>
      ) : null}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={campaignUi.title}>{title}</h1>
          {subtitle ? <p className={campaignUi.subtitle}>{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className={cn(right ? "grid gap-6 lg:grid-cols-[1fr_340px]" : "")}>
        <div className="min-w-0">{children}</div>
        {right ? <aside className="hidden lg:block">{right}</aside> : null}
      </div>
    </div>
  );
}

export function CampaignFilterTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-[#e5e7eb]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "border-b-2 px-4 py-2.5 text-[13px] font-semibold transition",
            active === tab.id
              ? "border-[#6366f1] text-[#6366f1]"
              : "border-transparent text-[#6b7280] hover:text-[#111827]",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
