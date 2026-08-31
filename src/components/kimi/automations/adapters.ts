import type { AutomationFlow } from "@/lib/types";
import type { KimiWorkflowRow } from "./types";

export function formatAutomationUpdated(at: string): string {
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function apiAutomationToKimi(flow: AutomationFlow): KimiWorkflowRow {
  const active = flow.status === "Active";
  return {
    id: flow.id,
    name: flow.name,
    description: flow.trigger || flow.createdFrom || "Automation workflow",
    lastSaved: formatAutomationUpdated(flow.updatedAt),
    currentContacts: flow.enrolled,
    clicks: flow.messagesSent,
    unsubscribes: 0,
    revenue: flow.completionRate > 0 ? `${flow.completionRate.toFixed(0)}% complete` : "—",
    status: active ? "Active" : "Inactive",
  };
}
