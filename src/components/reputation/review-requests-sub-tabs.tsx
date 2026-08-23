"use client";

import { cn } from "@/lib/utils";

export type ReviewRequestsSection = "poster" | "messages" | "triggers" | "settings" | "send" | "bulk" | "tracking";

const SECTIONS: Array<{ id: Extract<ReviewRequestsSection, "poster" | "messages" | "triggers" | "settings">; label: string }> = [
  { id: "poster", label: "Contacts" },
  { id: "messages", label: "Templates" },
  { id: "triggers", label: "Review Triggers" },
  { id: "settings", label: "Review Settings" },
];

export function ReviewRequestsSubTabs({
  active,
  onChange,
}: {
  active: ReviewRequestsSection;
  onChange: (section: ReviewRequestsSection) => void;
}) {
  return (
    <div className="-mb-px flex flex-wrap gap-4 border-b border-border">
      {SECTIONS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "-mb-px border-b-2 px-1 pb-2.5 pt-1 text-[13px] font-medium transition-colors",
            active === tab.id
              ? "border-primary text-emerald-700"
              : "border-transparent text-text-muted hover:border-border hover:text-text"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
