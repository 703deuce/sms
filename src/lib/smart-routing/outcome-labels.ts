/** Human-readable routing outcome labels for activity feeds and call detail. */
export function formatRoutingOutcome(
  outcome: string | null | undefined,
  context?: { destinationLabel?: string | null },
): string {
  const raw = String(outcome ?? "").trim();
  if (!raw) return "In progress";

  const label = context?.destinationLabel?.trim();
  const map: Record<string, string> = {
    connected: label ? `Answered by ${label}` : "Answered",
    no_answer: "No answer",
    voicemail: "Voicemail",
    callback_requested: "Callback requested",
    sms_triggered: "Missed call text sent",
    caller_replied: "Caller replied",
    screened_out: "Screened out",
    caller_hung_up: "Caller hung up",
    after_hours: "After hours",
    temporary_closure: "After hours (closed now)",
    no_selection: "No menu selection",
    consent_playback_failed: "Consent playback failed",
    routing_error: "Routing error",
    completed: "Completed",
  };

  if (map[raw]) return map[raw];

  const normalized = raw.replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
