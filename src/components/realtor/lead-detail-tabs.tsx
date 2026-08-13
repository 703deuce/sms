"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
  { id: "conversations", label: "Conversations" },
  { id: "appointments", label: "Appointments" },
  { id: "tasks", label: "Tasks" },
  { id: "notes", label: "Notes" },
  { id: "properties", label: "Properties" },
  { id: "documents", label: "Documents" },
] as const;

export function LeadDetailTabs({
  activityCount,
  appointmentCount,
  notesCount,
  tasksCount,
}: {
  activityCount?: number;
  appointmentCount?: number;
  notesCount?: number;
  tasksCount?: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get("tab") || "overview";

  function href(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "overview") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function label(tab: typeof TABS[number]) {
    if (tab.id === "activity" && activityCount) return `${tab.label} (${activityCount})`;
    if (tab.id === "appointments" && appointmentCount) return `${tab.label} (${appointmentCount})`;
    if (tab.id === "notes" && notesCount) return `${tab.label} (${notesCount})`;
    if (tab.id === "tasks" && tasksCount) return `${tab.label} (${tasksCount})`;
    return tab.label;
  }

  return (
    <div className="flex flex-wrap gap-6 border-b border-[#e5e7eb] text-[14px]">
      {TABS.map((tab) => {
        const isActive = active === tab.id || (tab.id === "overview" && !searchParams.get("tab"));
        return (
          <Link
            key={tab.id}
            href={href(tab.id)}
            className={
              isActive
                ? "border-b-2 border-[#6366f1] pb-2 font-semibold text-[#6366f1]"
                : "pb-2 text-[#6b7280] hover:text-[#111827]"
            }
          >
            {label(tab)}
          </Link>
        );
      })}
    </div>
  );
}
