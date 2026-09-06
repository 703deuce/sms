"use client";

import { useState } from "react";
import { analyticsTabs } from "../mock-data";
import { AnalyticsAutomations } from "./AnalyticsAutomations";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Tabs({
  items,
  activeHref,
  onSelect,
}: {
  items: Array<{ label: string; href: string }>;
  activeHref: string;
  onSelect?: (href: string) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-1 overflow-x-auto border-b border-border tv-scrollbar" role="tablist" aria-label="Analytics sections">
      {items.map((item) => {
        const active = item.href === activeHref;
        return (
          <button
            key={item.href}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect?.(item.href)}
            className={cn(
              "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-semibold transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
            style={{ background: "none", cursor: "pointer" }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function AnalyticsShell({ section = "automations" }: { section?: string }) {
  const [active, setActive] = useState("/appointments/analytics/automations");

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      {/* Page header */}
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">
            Analytics
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Operational performance across appointments, booking, reminders, and automations.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Tabs items={analyticsTabs} activeHref={active} onSelect={setActive} />
      </div>

      {active.endsWith("/automations") || section === "automations" ? (
        <AnalyticsAutomations />
      ) : (
        <div className="surface rounded-xl bg-card px-6 py-12 text-center">
          <p className="text-sm font-semibold text-foreground">
            {analyticsTabs.find((t) => t.href === active)?.label ?? "Section"}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            This analytics section is a peer view of Automations. Select Automations to view workflow performance.
          </p>
          <button
            onClick={() => setActive("/appointments/analytics/automations")}
            className="mt-4 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold"
            style={{ color: "#fff", border: "none", cursor: "pointer" }}
          >
            View Automations
          </button>
        </div>
      )}
    </div>
  );
}
