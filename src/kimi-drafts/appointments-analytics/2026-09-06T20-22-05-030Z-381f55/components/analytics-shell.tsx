"use client";

import { useState } from "react";
import { analyticsTabs, type AnalyticsSection } from "../mock-data";
import { AnalyticsClient } from "./analytics-client";
import { cn } from "./ui";

function Tabs({
  active,
  onChange,
}: {
  active: AnalyticsSection;
  onChange: (s: AnalyticsSection) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Analytics sections"
      className="mb-6 flex flex-wrap gap-1 overflow-x-auto border-b border-border"
    >
      {analyticsTabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-semibold transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function AnalyticsShell() {
  const [section, setSection] = useState<AnalyticsSection>("overview");

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
        <Tabs active={section} onChange={setSection} />
        <AnalyticsClient section={section} />
      </div>
    </div>
  );
}
