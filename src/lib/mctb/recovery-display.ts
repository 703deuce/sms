/** Customer-facing recovery / reply labels — Suppressed ≠ Failed. */

export function formatRecoveryStatus(status: string, suppressionReason?: string | null): string {
  const s = status.toUpperCase();
  if (s === "SUPPRESSED") {
    if (suppressionReason === "OPTED_OUT") return "Opted out";
    if (suppressionReason === "RECOVERY_PAUSED") return "Suppressed";
    return "Suppressed";
  }
  if (s === "FAILED") return "Failed";
  if (s === "CUSTOMER_REPLIED") return "Delivered";
  if (s === "SENT" || s === "SMS_SENT") return "Sent";
  if (s === "SCHEDULED") return "Scheduled";
  if (s === "WAITING_CONSENT" || s === "PENDING_CONSENT") return "Waiting for consent";
  if (s === "ELIGIBLE") return "Eligible";
  if (s === "SENDING") return "Sending";
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function formatReplyStatus(status: string): string {
  const s = status.toUpperCase();
  if (s === "CUSTOMER_REPLIED") return "Replied";
  if (s === "SUPPRESSED" || s === "OPTED_OUT") return "No reply";
  if (s === "SENT" || s === "SMS_SENT") return "No reply";
  return "—";
}

export function formatConsentModeLabel(mode: string | null | undefined): string {
  if (mode === "press_1") return "Verified Call Consent";
  if (mode === "existing_consent") return "Existing permission";
  return "Not configured";
}
