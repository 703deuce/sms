import "server-only";

import type {
  ExtendedCancellationPolicy,
  ExtendedReschedulePolicy,
  SchedulingCutoff,
  SchedulingLimitsConfig,
} from "./types";

function cutoffToMs(cutoff?: SchedulingCutoff): number | null {
  if (!cutoff?.enabled || !cutoff.value) return null;
  const mult =
    cutoff.unit === "minutes" ? 60_000 : cutoff.unit === "hours" ? 3_600_000 : 86_400_000;
  return cutoff.value * mult;
}

export function evaluateExtendedCancellationPolicy(
  policy: ExtendedCancellationPolicy | undefined,
  startsAt: Date,
  now = new Date(),
): { allowed: boolean; afterCutoff: boolean; reason?: string; behavior?: string } {
  if (!policy || policy.allowed === "anytime") {
    return { allowed: true, afterCutoff: false };
  }
  if (policy.allowed === "disabled") {
    return {
      allowed: false,
      afterCutoff: false,
      reason: policy.policyText || "Cancellation is not allowed",
    };
  }
  const ms = cutoffToMs(policy.cutoff);
  if (ms == null) return { allowed: true, afterCutoff: false };
  const remaining = startsAt.getTime() - now.getTime();
  if (remaining >= ms) return { allowed: true, afterCutoff: false };
  if (policy.afterCutoff && policy.afterCutoff !== "block_contact_business") {
    return {
      allowed: true,
      afterCutoff: true,
      behavior: policy.afterCutoff,
      reason: policy.policyText,
    };
  }
  return {
    allowed: false,
    afterCutoff: true,
    behavior: policy.afterCutoff || "block_contact_business",
    reason: policy.policyText || "Cancellation cutoff has passed — contact the business",
  };
}

export function evaluateExtendedReschedulePolicy(
  policy: ExtendedReschedulePolicy | undefined,
  startsAt: Date,
  now = new Date(),
): { allowed: boolean; afterCutoff: boolean; reason?: string; behavior?: string } {
  if (!policy || policy.allowed === "anytime") {
    return { allowed: true, afterCutoff: false };
  }
  if (policy.allowed === "disabled") {
    return {
      allowed: false,
      afterCutoff: false,
      reason: policy.policyText || "Rescheduling is not allowed",
    };
  }
  const ms = cutoffToMs(policy.cutoff);
  if (ms == null) return { allowed: true, afterCutoff: false };
  const remaining = startsAt.getTime() - now.getTime();
  if (remaining >= ms) return { allowed: true, afterCutoff: false };
  if (policy.afterCutoff && policy.afterCutoff !== "block_contact_business") {
    return {
      allowed: true,
      afterCutoff: true,
      behavior: policy.afterCutoff,
      reason: policy.policyText,
    };
  }
  return {
    allowed: false,
    afterCutoff: true,
    behavior: policy.afterCutoff || "block_contact_business",
    reason: policy.policyText || "Reschedule cutoff has passed — contact the business",
  };
}

export function resolveSchedulingLimits(
  platform?: SchedulingLimitsConfig,
  typeOverride?: SchedulingLimitsConfig,
): SchedulingLimitsConfig {
  return {
    ...platform,
    ...typeOverride,
    bookingLimits: {
      ...platform?.bookingLimits,
      ...typeOverride?.bookingLimits,
    },
  };
}
