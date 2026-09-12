import type { MctbDemoSession, MctbOnboardingState } from "@/lib/mctb/onboarding/types";
import {
  isDemoModeForWorkspace,
  isPlatformDemoNumber,
} from "@/lib/mctb/onboarding/demo";

export type MctbIngressKind = "demo_direct" | "production_forwarded";

const PRODUCTION_ONBOARDING_STEPS = new Set([
  "connect",
  "connect_calls",
  "live_test",
  "review_test",
  "complete",
  "ready",
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
  const steps = state.completedSteps;
  const pastDemo =
    steps.includes("demo") ||
    steps.includes("recovery") ||
    steps.includes("consent") ||
    Boolean(state.workspaceTollFreeNumber || state.trialNumber);
  return (
    pastDemo &&
    (steps.includes("connect") ||
      steps.includes("connect_calls") ||
      steps.includes("live_test") ||
      steps.includes("review_test") ||
      Boolean(state.forwardingTestStartedAt) ||
      Boolean(state.liveTestSession?.startedAt))
  );
}

/**
 * Try It entry: direct call to the shared platform demo DID with an active session.
 * Production entry: forwarded call to the workspace-assigned MCTB DID.
 * Both use the same frozen SIP/LiveKit handler — demoMode only classifies entry + trial SMS.
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

/** Runtime Try It flag — direct demo ingress (no carrier forward). Same SIP engine as production. */
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
