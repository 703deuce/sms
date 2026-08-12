"use client";

import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export function CrmPageTabs({
  tabs,
  active,
  onChange,
  accent = "#7c3aed",
}: {
  tabs: Array<string | { label: string; count?: number }>;
  active: string;
  onChange?: (tab: string) => void;
  accent?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-[#e5e7eb]">
      {tabs.map((tab) => {
        const label = typeof tab === "string" ? tab : tab.label;
        const count = typeof tab === "string" ? undefined : tab.count;
        const isActive = label === active;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange?.(label)}
            className={cn(
              "mb-[-1px] border-b-2 px-3 py-2.5 text-[13px] font-semibold transition",
              isActive ? "text-[#111827]" : "border-transparent text-[#6b7280] hover:text-[#111827]",
            )}
            style={isActive ? { borderBottomColor: accent, color: accent } : undefined}
          >
            {label}
            {count !== undefined ? ` (${count})` : ""}
          </button>
        );
      })}
    </div>
  );
}

export function CrmKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className="realtor-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">{label}</p>
          <p className="mt-2 text-[24px] font-bold text-[#111827]">{value}</p>
          {hint ? <p className="mt-1 text-[12px] text-emerald-600">{hint}</p> : null}
        </div>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-[10px]", tone)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}
