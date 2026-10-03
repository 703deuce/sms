import "server-only";

import { isOnboardingComplete } from "@/lib/mctb/onboarding/completion";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Onboarding / live-test recovery: no production suppression rules (cooldown, caps, schedule).
 * Opt-out and invalid caller still apply elsewhere in eligibility.
 */
export async function isMctbTestRecoveryContext(
  workspaceId: string,
  eventMetadata?: Record<string, unknown> | null,
): Promise<boolean> {
  const meta = asRecord(eventMetadata);
  if (
    meta.liveTest === true ||
    meta.setupTest === true ||
    meta.testSms === true ||
    meta.setupSms === true ||
    meta.excludeFromRecoveryUsage === true
  ) {
    return true;
  }

  const onboarding = await loadMctbOnboardingState(workspaceId);
  if (!isOnboardingComplete(onboarding)) return true;
  if (onboarding.liveTestSession?.startedAt && !onboarding.liveTestPassedAt) {
    return true;
  }

  return false;
}
