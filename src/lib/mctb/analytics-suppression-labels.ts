/** Customer-facing labels for missed-call suppression reason codes. */
const SUPPRESSION_LABELS: Record<string, string> = {
  TRIGGER_DISABLED: "Trigger disabled",
  COOLDOWN: "Cooldown",
  COOLDOWN_ACTIVE: "Cooldown active",
  COOLDOWN_CLEARED_FOR_CERT: "Cooldown cleared",
  MESSAGING_NOT_APPROVED: "Messaging approval pending",
  MESSAGING_APPROVAL_PENDING: "Messaging approval pending",
  NOT_FORWARD_EVENT: "Not a forwarded missed call",
  NOT_EXISTING_CONSENT: "Waiting for consent",
  OPTED_OUT: "Opted out",
  SUPPRESSED: "Suppressed",
  DUPLICATE: "Duplicate event",
  QUIET_HOURS: "Outside quiet hours",
  RATE_LIMITED: "Rate limited",
};

export function formatSuppressionReasonLabel(raw: string): string {
  const key = raw.trim().toUpperCase().replace(/\s+/g, "_");
  if (SUPPRESSION_LABELS[key]) return SUPPRESSION_LABELS[key];
  const polished = raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  if (/cooldown cleared/i.test(polished)) return "Cooldown cleared";
  if (/cooldown active/i.test(polished)) return "Cooldown active";
  if (/not forward/i.test(polished)) return "Not a forwarded missed call";
  if (/messaging/i.test(polished) && /approv/i.test(polished)) return "Messaging approval pending";
  return polished || "Other suppression";
}

export function suppressionMissedCallsHref(
  reason: string,
  dateFilter: "7d" | "30d" | "all",
): string {
  const params = new URLSearchParams();
  params.set("status", "suppressed");
  params.set("date", dateFilter);
  params.set("q", reason);
  return `/mctb/missed-calls?${params.toString()}`;
}
