export const PORT_STATUSES = [
  "pending",
  "docs_needed",
  "submitted",
  "in_progress",
  "foc_confirmed",
  "completed",
  "rejected",
  "cancelled",
] as const;

export type PortStatus = (typeof PORT_STATUSES)[number];

export function portStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "Pending review",
    docs_needed: "Documents needed",
    submitted: "Submitted to carrier",
    in_progress: "In progress with carrier",
    foc_confirmed: "FOC confirmed",
    completed: "Completed",
    rejected: "Rejected",
    cancelled: "Cancelled",
  };
  return map[status] || status;
}
