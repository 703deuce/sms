/** Appointment Reminders product: operational UI is SMS-only (no voice-call reminder rows). */
export function isSmsReminderTimelineEvent(type: string): boolean {
  const t = String(type || "").toLowerCase();
  if (t.includes("voice")) return false;
  if (t.includes("email") && !t.includes("sms")) return false;
  return (
    t.includes("reminder") ||
    t.includes("confirmation") ||
    t.includes("workflow_") ||
    t.includes("sms")
  );
}

export function mapSmsReminderTimelineOutcome(type: string): {
  status: "sent" | "delivered" | "failed" | "skipped" | "logged";
  statusLabel: string;
} {
  const t = String(type || "").toLowerCase();
  if (t.includes("failed")) return { status: "failed", statusLabel: "Failed" };
  if (t.includes("skipped")) return { status: "skipped", statusLabel: "Skipped" };
  if (t.includes("delivered")) return { status: "delivered", statusLabel: "Delivered" };
  if (t.includes("suppressed") || t.includes("stopped") || t.includes("cleared")) {
    return { status: "logged", statusLabel: "Recorded" };
  }
  if (t.endsWith("_sent") || t === "confirmation_sent") {
    return { status: "sent", statusLabel: "Sent" };
  }
  return { status: "logged", statusLabel: "Recorded" };
}
