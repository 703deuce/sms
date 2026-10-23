/** M13 / M42 / M59 — abandonment safe harbor, throttle, and hard stop (jurisdiction-aware defaults). */

export type AbandonmentPolicy = {
  reportingWindowDays: number;
  targetAbandonRatePct: number;
  throttleAbovePct: number;
  hardStopPct: number;
  policyMessageRequired: boolean;
};

export const DEFAULT_ABANDONMENT_POLICY: AbandonmentPolicy = {
  reportingWindowDays: 30,
  targetAbandonRatePct: 3,
  throttleAbovePct: 2.5,
  hardStopPct: 3,
  policyMessageRequired: true,
};

export type AbandonmentCounts = {
  abandonedCount: number;
  connectedCount: number;
};

export type AbandonmentSnapshot = AbandonmentCounts & {
  ratePct: number;
};

export function computeAbandonRate(snapshot: AbandonmentCounts): number | null {
  const total = snapshot.abandonedCount + snapshot.connectedCount;
  if (total <= 0) return null;
  return Math.round((snapshot.abandonedCount / total) * 1000) / 10;
}

export function evaluateAbandonmentSafeguards(
  policy: AbandonmentPolicy,
  snapshot: AbandonmentCounts,
): {
  autoThrottle: boolean;
  hardStop: boolean;
  pacingMultiplier: number;
} {
  const rate = computeAbandonRate(snapshot);
  if (rate == null) {
    return { autoThrottle: false, hardStop: false, pacingMultiplier: 1 };
  }
  const hardStop = rate >= policy.hardStopPct;
  const autoThrottle = !hardStop && rate >= policy.throttleAbovePct;
  let pacingMultiplier = 1;
  if (autoThrottle) {
    const over = rate - policy.targetAbandonRatePct;
    pacingMultiplier = Math.max(0.25, 1 - over / policy.hardStopPct);
  }
  if (hardStop) pacingMultiplier = 0;
  return { autoThrottle, hardStop, pacingMultiplier };
}

/** Shipped default: no automated abandonment audio until counsel approves copy and URL. */
export const ABANDONMENT_POLICY_AUDIO_SHIPPED = false;

export type AbandonmentSafeHarborAction = "play_policy_message" | "offer_callback" | "opt_out_prompt";

/** Planning-only metadata — never plays audio while `ABANDONMENT_POLICY_AUDIO_SHIPPED` is false. */
export function safeHarborActionsForJurisdiction(jurisdictionPreset: string): AbandonmentSafeHarborAction[] {
  if (jurisdictionPreset === "ftc_telemarketing") {
    return ["play_policy_message", "opt_out_prompt"];
  }
  return ["play_policy_message", "offer_callback"];
}
