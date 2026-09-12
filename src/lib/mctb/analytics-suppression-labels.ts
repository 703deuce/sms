/** Customer-facing labels for missed-call suppression reason codes. */
const SUPPRESSION_LABELS: Record<string, string> = {
  TRIGGER_DISABLED: "Trigger disabled",
  COOLDOWN: "Cooldown",
  COOLDOWN_ACTIVE: "Cooldown active",
  COOLDOWN_CLEARED_FOR_CERT: "Cooldown cleared",
  MESSAGING_NOT_APPROVED: "Messaging not yet approved",
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
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
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
