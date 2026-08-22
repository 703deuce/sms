import type { MctbDemoSession, MctbOnboardingState } from "@/lib/mctb/onboarding/types";
import {
  isDemoModeForWorkspace,
  isPlatformDemoNumber,
} from "@/lib/mctb/onboarding/demo";

export type MctbIngressKind = "demo_direct" | "production_forwarded";

const PRODUCTION_ONBOARDING_STEPS = new Set([
  "connect",
  "live_test",
  "complete",
]);

/** Demo never requires carrier forwarding — direct call to platform demo DID only. */
export function demoRequiresForwarding(): boolean {
  return false;
}

/** Production activation requires forwarding setup + verification before live test. */
export function productionRequiresForwardingSetup(): boolean {
  return true;
}

/** True when onboarding is in the production activation phase (post-demo). */
export function isProductionActivationPhase(state: MctbOnboardingState): boolean {
  if (PRODUCTION_ONBOARDING_STEPS.has(state.currentStep)) return true;
  return (
    state.completedSteps.includes("demo") &&
    (state.completedSteps.includes("connect") ||
      state.completedSteps.includes("live_test") ||
      Boolean(state.forwardingTestStartedAt) ||
      Boolean(state.liveTestSession?.startedAt))
  );
}

/**
 * Demo ingress: direct call to platform demo DID with an active demo session.
 * Forwarded calls are never treated as demo — they belong to production onboarding.
 */
export function isDemoDirectIngress(input: {
  transovoNumberE164: string;
  callerE164: string;
  forwardedFromE164?: string | null;
  demoSession?: MctbDemoSession | null;
}): boolean {
  if (input.forwardedFromE164?.trim()) return false;
  return isDemoModeForWorkspace(
    "",
    input.transovoNumberE164,
    input.callerE164,
    input.demoSession,
  );
}

/**
 * Production ingress: forwarded call to a customer-assigned MCTB DID (or platform
 * line during production onboarding verification with forwardedFrom metadata).
 */
export function isProductionForwardedIngress(input: {
  transovoNumberE164: string;
  forwardedFromE164?: string | null;
  onboardingState?: MctbOnboardingState | null;
}): boolean {
  if (input.forwardedFromE164?.trim()) return true;
  if (!isPlatformDemoNumber(input.transovoNumberE164)) return true;
  if (!input.onboardingState) return false;
  return isProductionActivationPhase(input.onboardingState);
}

/** Runtime demoMode flag — only true for direct demo ingress, never live test / forwarding. */
export function resolveRuntimeDemoMode(input: {
  workspaceId: string;
  transovoNumberE164: string;
  callerE164: string;
  forwardedFromE164?: string | null;
  demoSession?: MctbDemoSession | null;
  forceDemoMode?: boolean;
}): boolean {
  if (input.forceDemoMode) return true;
  return isDemoDirectIngress({
    transovoNumberE164: input.transovoNumberE164,
    callerE164: input.callerE164,
    forwardedFromE164: input.forwardedFromE164,
    demoSession: input.demoSession,
  });
}

export function classifyMctbIngress(input: {
  transovoNumberE164: string;
  callerE164: string;
  forwardedFromE164?: string | null;
  demoSession?: MctbDemoSession | null;
  onboardingState?: MctbOnboardingState | null;
}): MctbIngressKind {
  if (
    isDemoDirectIngress({
      transovoNumberE164: input.transovoNumberE164,
      callerE164: input.callerE164,
      forwardedFromE164: input.forwardedFromE164,
      demoSession: input.demoSession,
    })
  ) {
    return "demo_direct";
  }
  return "production_forwarded";
}
