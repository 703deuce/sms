"use client";

import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export function AgentPageTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange?: (tab: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-[#e5e7eb]">
      {tabs.map((tab) => {
        const isActive = tab === active;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange?.(tab)}
            className={cn(
              "mb-[-1px] border-b-2 px-3 py-2.5 text-[13px] font-semibold transition",
              isActive
                ? "border-[#7c3aed] text-[#7c3aed]"
                : "border-transparent text-[#6b7280] hover:text-[#111827]",
            )}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

export function AgentKpiCard({
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
