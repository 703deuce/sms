/** UI helpers for missed-calls list — display only, no domain changes. */

const ACTIONABLE_SUPPRESSION = new Set([
  "NOT_EXISTING_CONSENT",
  "MESSAGING_NOT_READY",
  "SENDER_UNAVAILABLE",
  "MESSAGING_BLOCKED",
  "PROVIDER_REJECTED",
  "WORKSPACE_INACTIVE",
]);

export type MissedCallActionableIssue = {
  show: boolean;
  message: string;
};

export function missedCallActionableIssue(
  status: string,
  suppressionReason: string | null,
): MissedCallActionableIssue {
  const s = status.toUpperCase();
  if (s === "FAILED") {
    const detail = suppressionReason
      ? suppressionReason.replace(/_/g, " ").toLowerCase()
      : "delivery failed";
    return { show: true, message: detail };
  }
  if (suppressionReason && ACTIONABLE_SUPPRESSION.has(suppressionReason)) {
    return {
      show: true,
      message: suppressionReason.replace(/_/g, " ").toLowerCase(),
    };
  }
  const reason = suppressionReason?.toUpperCase() ?? "";
  if (
    reason.includes("PROVIDER") ||
    reason.includes("SENDER") ||
    reason.includes("MESSAGING")
  ) {
    return {
      show: true,
      message: suppressionReason!.replace(/_/g, " ").toLowerCase(),
    };
  }
  return { show: false, message: "" };
}
