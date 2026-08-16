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

/** Customer-facing Personal port-in status labels */
export function personalPortInStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "Preparing",
    docs_needed: "Action Required",
    submitted: "Submitted",
    in_progress: "Carrier Review",
    foc_confirmed: "Scheduled",
    completed: "Completed",
    rejected: "Action Required",
    cancelled: "Cancelled",
  };
  return map[status] || portStatusLabel(status);
}

export const PERSONAL_PORT_IN_STAGES = [
  "Preparing",
  "Submitted",
  "Carrier Review",
  "Action Required",
  "Scheduled",
  "Completed",
] as const;
