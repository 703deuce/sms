import type { MctbOnboardingState } from "@/lib/mctb/onboarding/types";
import { normalizeOnboardingStep } from "@/lib/mctb/onboarding/wizard-flow";

/** Client-safe: no DB, jobs, or server-only imports. */
export function isOnboardingComplete(state: MctbOnboardingState): boolean {
  if (state.trialActivatedAt) return true;
  if (state.liveTestPassedAt) return true;
  const step = normalizeOnboardingStep(state.currentStep);
  if (step === "complete" || step === "ready") return true;
  return false;
}
