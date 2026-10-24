/**
 * Pure MCTB analytics metric helpers — shared by loadMctbAnalytics and unit tests.
 */

export type MissedCallAnalyticsRow = {
  status: string;
  suppressionReason: string | null;
  smsSentAt: Date | null;
  eligible: boolean;
  detectedAt: Date;
};

/** Authoritative recovery text sent (outbound recovery SMS recorded on the event). */
export function isRecoveryTextSent(row: MissedCallAnalyticsRow): boolean {
  return row.smsSentAt != null;
}

export function isCustomerReplied(row: MissedCallAnalyticsRow): boolean {
  return row.status.toUpperCase() === "CUSTOMER_REPLIED";
}

export function isSuppressed(row: MissedCallAnalyticsRow): boolean {
  return row.status.toUpperCase() === "SUPPRESSED";
}

export function isDeliveryFailed(row: MissedCallAnalyticsRow): boolean {
  return row.status.toUpperCase() === "FAILED";
}

export function isEligibleForRecovery(row: MissedCallAnalyticsRow): boolean {
  return row.eligible === true;
}

export function safeRatePercent(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0 || numerator < 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function computeFunnelCounts(rows: MissedCallAnalyticsRow[]) {
  const totalMissed = rows.length;
  const eligible = rows.filter(isEligibleForRecovery).length;
  const textsSent = rows.filter(isRecoveryTextSent).length;
  const replies = rows.filter(isCustomerReplied).length;
  const suppressed = rows.filter(isSuppressed).length;
  const deliveryFailures = rows.filter(isDeliveryFailed).length;

  return {
    totalMissed,
    eligible,
    textsSent,
    replies,
    suppressed,
    deliveryFailures,
    eligibilityRate: safeRatePercent(eligible, totalMissed),
    sendRate: safeRatePercent(textsSent, eligible),
    replyRate: safeRatePercent(replies, textsSent),
  };
}
