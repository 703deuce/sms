"use client";

import { appointmentsAnalyticsTabs, AppointmentsAnalyticsSection } from "../mock-data";
import { AppointmentsAnalyticsClient } from "./analytics-client";

function Tabs({
  items,
  activeHref,
}: {
  items: Array<{ label: string; href: string }>;
  activeHref: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Analytics sections"
      className="mb-6 flex flex-wrap gap-1 overflow-x-auto border-b border-border"
    >
      {items.map((item) => {
        const active = item.href === activeHref;
        return (
          <a
            key={item.href}
            href={item.href}
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            className={[
              "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-semibold transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            ].join(" ")}
          >
            {item.label}
          </a>
        );
      })}
    </div>
  );
}

export function AppointmentsAnalyticsShell({
  section = "overview",
}: {
  section?: AppointmentsAnalyticsSection;
}) {
  const activeHref =
    appointmentsAnalyticsTabs.find(
      (t) => t.label.toLowerCase() === section
    )?.href ?? "/appointments/analytics";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
      <Tabs items={appointmentsAnalyticsTabs} activeHref={activeHref} />
      <AppointmentsAnalyticsClient section={section} />
    </div>
  );
}
