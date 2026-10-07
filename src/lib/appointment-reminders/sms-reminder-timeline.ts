/** Appointment Reminders product: operational UI is SMS-only (no voice-call reminder rows). */
export function isSmsReminderTimelineEvent(type: string): boolean {
  const t = String(type || "").toLowerCase();
  if (t.includes("voice")) return false;
  return (
    t.includes("reminder") ||
    t.includes("confirmation") ||
    t.includes("workflow_") ||
    t.includes("sms")
  );
}
