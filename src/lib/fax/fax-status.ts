import type { FaxTransmissionStatus } from "./types";

/** Customer-facing delivery lifecycle labels (not raw Telnyx codes). */
export type FaxDisplayStatus =
  | "preparing"
  | "queued"
  | "connecting"
  | "transmitting"
  | "delivered"
  | "received"
  | "failed"
  | "scheduled"
  | "cancelled";

const STATUS_LABELS: Record<FaxDisplayStatus, string> = {
  preparing: "Preparing",
  queued: "Queued",
  connecting: "Connecting",
  transmitting: "Transmitting",
  delivered: "Delivered",
  received: "Received",
  failed: "Failed",
  scheduled: "Scheduled",
  cancelled: "Cancelled",
};

export function faxDisplayStatusLabel(status: FaxDisplayStatus): string {
  return STATUS_LABELS[status] || status;
}

/** Map internal/Telnyx status + event type to a customer-facing lifecycle state. */
export function mapToFaxDisplayStatus(input: {
  status: string;
  eventType?: string;
  direction?: string;
}): FaxDisplayStatus {
  const s = String(input.status || "").toLowerCase();
  const event = String(input.eventType || "").toLowerCase();

  if (s === "scheduled") return "scheduled";
  if (s === "cancelled") return "cancelled";
  if (s === "received") return "received";
  if (s === "delivered" || s === "completed" || s === "success") return "delivered";
  if (s === "failed" || s === "failure") return "failed";

  if (event.includes("media.processed") || s === "media_processed") return "preparing";
  if (s === "queued" || s === "pending") return "queued";
  if (event.includes("fax.sending") || s === "sending" || s === "in_progress") return "transmitting";
  if (event.includes("fax.queued")) return "queued";

  if (s === "sending") return "transmitting";
  return "queued";
}

export const FAX_LIFECYCLE_STEPS_OUTBOUND: FaxDisplayStatus[] = [
  "preparing",
  "queued",
  "connecting",
  "transmitting",
  "delivered",
];

export function lifecycleProgress(displayStatus: FaxDisplayStatus): number {
  const idx = FAX_LIFECYCLE_STEPS_OUTBOUND.indexOf(displayStatus);
  if (displayStatus === "failed" || displayStatus === "cancelled") return 0;
  if (displayStatus === "delivered") return 100;
  if (idx < 0) return 10;
  return Math.round(((idx + 1) / FAX_LIFECYCLE_STEPS_OUTBOUND.length) * 100);
}

export function isTerminalFaxStatus(status: FaxTransmissionStatus | string): boolean {
  return ["delivered", "received", "failed", "cancelled"].includes(String(status).toLowerCase());
}
