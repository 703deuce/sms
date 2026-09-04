import type { CancellationPolicy, ReschedulePolicy } from "@/lib/appointments/types";

export function evaluateCancellationPolicy(
  policy: CancellationPolicy | undefined,
  startsAt: Date,
  now = new Date(),
): { allowed: boolean; reason?: string } {
  if (!policy || policy.allowed === "anytime") return { allowed: true };
  if (policy.allowed === "disabled") {
    return { allowed: false, reason: policy.policyText || "Cancellation is not allowed" };
  }
  const cutoffMs = (policy.cutoffHours || 24) * 3_600_000;
  if (startsAt.getTime() - now.getTime() < cutoffMs) {
    return {
      allowed: false,
      reason: policy.policyText || `Cancellation must be at least ${policy.cutoffHours || 24} hours before`,
    };
  }
  return { allowed: true };
}

export function evaluateReschedulePolicy(
  policy: ReschedulePolicy | undefined,
  startsAt: Date,
  now = new Date(),
): { allowed: boolean; reason?: string } {
  if (!policy || policy.allowed === "anytime") return { allowed: true };
  if (policy.allowed === "disabled") {
    return { allowed: false, reason: policy.policyText || "Rescheduling is not allowed" };
  }
  const cutoffMs = (policy.cutoffHours || 24) * 3_600_000;
  if (startsAt.getTime() - now.getTime() < cutoffMs) {
    return {
      allowed: false,
      reason: policy.policyText || `Reschedule must be at least ${policy.cutoffHours || 24} hours before`,
    };
  }
  return { allowed: true };
}
