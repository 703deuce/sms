import type { MctbOnboardingState } from "@/lib/mctb/onboarding/types";
import { normalizeOnboardingStep } from "@/lib/mctb/onboarding/wizard-flow";

/** Client-safe: no DB, jobs, or server-only imports. */
export function isOnboardingComplete(state: MctbOnboardingState): boolean {
  if (!state.trialActivatedAt) return false;
  const step = normalizeOnboardingStep(state.currentStep);
  return step === "complete" || Boolean(state.trialActivatedAt);
}
