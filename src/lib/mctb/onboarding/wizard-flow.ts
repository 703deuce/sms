import type { MctbOnboardingState, MctbOnboardingStep } from "@/lib/mctb/onboarding/types";
import { MCTB_ONBOARDING_STEP_ORDER, MCTB_ONBOARDING_STEP_LABELS } from "@/lib/mctb/onboarding/types";

/** Primary six-step wizard labels shown in the progress rail. */
export const MCTB_WIZARD_PRIMARY_STEPS: MctbOnboardingStep[] = [
  "business_line",
  "connect_calls",
  "consent",
  "recovery",
  "notifications",
  "voicemail",
  "review_test",
];

export const MCTB_WIZARD_PRIMARY_LABELS: Record<string, string> = {
  business_line: "Business line",
  connect_calls: "Connect calls",
  consent: "Consent",
  recovery: "Recovery",
  notifications: "Notifications",
  voicemail: "Voicemail",
  review_test: "Review & test",
  ready: "Ready",
};

const LEGACY_TO_CANONICAL: Record<string, MctbOnboardingStep> = {
  business: "business_line",
  connect: "connect_calls",
  trial_number: "recovery",
  configure: "recovery",
  tfv: "recovery",
  pending: "recovery",
  demo: "recovery",
  live_test: "review_test",
  complete: "ready",
};

export function normalizeOnboardingStep(step: unknown): MctbOnboardingStep {
  const raw = String(step || "business_line");
  if (LEGACY_TO_CANONICAL[raw]) return LEGACY_TO_CANONICAL[raw];
  if ((MCTB_ONBOARDING_STEP_ORDER as string[]).includes(raw)) {
    return raw as MctbOnboardingStep;
  }
  return "business_line";
}

export function normalizeCompletedSteps(steps: unknown): MctbOnboardingStep[] {
  if (!Array.isArray(steps)) return [];
  const out: MctbOnboardingStep[] = [];
  for (const s of steps) {
    const n = normalizeOnboardingStep(s);
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

export function wizardStageIndex(step: MctbOnboardingStep): number {
  const canonical = normalizeOnboardingStep(step);
  if (canonical === "ready") return MCTB_WIZARD_PRIMARY_STEPS.length;
  const idx = MCTB_WIZARD_PRIMARY_STEPS.indexOf(canonical);
  return idx >= 0 ? idx : 0;
}

export function wizardStageLabel(step: MctbOnboardingStep): string {
  const canonical = normalizeOnboardingStep(step);
  return MCTB_WIZARD_PRIMARY_LABELS[canonical] || MCTB_ONBOARDING_STEP_LABELS[canonical] || canonical;
}

export function isWizardTerminalStep(step: MctbOnboardingStep): boolean {
  return normalizeOnboardingStep(step) === "ready";
}

/** Infer best resume step from saved configuration when currentStep is stale. */
export function inferResumeStep(state: MctbOnboardingState): MctbOnboardingStep {
  const current = normalizeOnboardingStep(state.currentStep);
  if (current === "ready") return "ready";

  const completed = new Set(normalizeCompletedSteps(state.completedSteps));

  if (!completed.has("business_line") && !state.businessName?.trim()) {
    return "business_line";
  }
  if (!state.businessNumberE164?.trim() || !state.forwardingConnectedAt) {
    if (!completed.has("connect_calls")) return "connect_calls";
  }
  if (!completed.has("consent") && !state.consentMode) return "consent";
  if (!state.workspaceTollFreeNumber && !state.trialNumber) return "recovery";
  if (!completed.has("notifications")) return "notifications";
  if (!completed.has("voicemail")) return "voicemail";
  if (!state.trialActivatedAt && !state.liveTestPassedAt) return "review_test";
  return current;
}

export function productionActivationProgress(state: MctbOnboardingState): boolean {
  const completed = normalizeCompletedSteps(state.completedSteps);
  return (
    completed.includes("consent") ||
    completed.includes("recovery") ||
    completed.includes("connect_calls") ||
    Boolean(state.workspaceTollFreeNumber || state.trialNumber)
  );
}
