import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { getMctbEntitlement } from "@/lib/mctb/entitlement";
import { mctbSameE164 } from "@/lib/mctb/phone/e164-match";
import { validateExistingConsentAttestation } from "@/lib/mctb/capture/attestation";
import { resolveMctbCapabilities } from "@/lib/mctb/capabilities";
import { MCTB_CONSENT_MODE_EXISTING } from "@/lib/mctb/consent-mode";
import { loadMctbOnboardingState } from "./state";
import { getProductionMctbForwardTargetE164 } from "./phone-numbers";

export type OnboardingLiveTestRecoverySendInput = {
  workspaceId: string;
  idempotencyKey: string;
  callerE164: string;
  businessE164: string;
  phoneNumberId?: string | null;
  forwardedFromE164?: string | null;
};

function readForwardedFrom(metadata: Record<string, unknown>): string | null {
  const raw = metadata.forwardedFrom ?? metadata.forwardedFromE164;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function forwardingVerifiedForLiveTest(input: {
  forwardedFrom: string | null;
  businessLineE164: string | null;
  forwardTargetE164: string;
}): boolean {
  if (input.businessLineE164?.trim()) {
    return Boolean(
      input.forwardedFrom && mctbSameE164(input.forwardedFrom, input.businessLineE164),
    );
  }
  if (input.forwardedFrom) {
    return !mctbSameE164(input.forwardedFrom, input.forwardTargetE164);
  }
  return false;
}

async function consentSatisfiedForLiveTest(input: {
  workspaceId: string;
  consentMode: string | null | undefined;
  callerE164: string;
  sessionStartedAt: string;
  sessionConsentAt?: string | null;
}): Promise<boolean> {
  if (input.consentMode === MCTB_CONSENT_MODE_EXISTING) {
    const { isWorkspaceExistingConsentModeEligible } = await import(
      "@/lib/mctb/existing-consent-mode-eligibility"
    );
    const [modeEligible, caps, attestation] = await Promise.all([
      isWorkspaceExistingConsentModeEligible(input.workspaceId),
      resolveMctbCapabilities(input.workspaceId),
      validateExistingConsentAttestation(input.workspaceId),
    ]);
    if (!modeEligible) return false;
    if (!caps.existingConsentCertification) return false;
    if (!attestation.valid || !attestation.existingConsentValid) return false;
    return true;
  }
  if (input.sessionConsentAt) return true;

  const prisma = getPrisma();
  const since = new Date(input.sessionStartedAt);
  const consentEvent = await prisma.smartRoutingSmsConsentEvent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      callerNumber: input.callerE164,
      consentedAt: { gte: since },
    },
    orderBy: { consentedAt: "desc" },
  });
  return Boolean(consentEvent);
}

/**
 * Narrow onboarding exception: allow exactly one platform-sender recovery SMS for the
 * active live-test missed-call event. All other automatic recovery during onboarding stays blocked.
 */
export async function authorizeOnboardingLiveTestRecoverySend(
  input: OnboardingLiveTestRecoverySendInput,
): Promise<boolean> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { billingPlan: true },
  });
  if (!ws || String(ws.billingPlan || "").toLowerCase() !== "onboarding") {
    return false;
  }

  const entitlement = await getMctbEntitlement(input.workspaceId);
  if (entitlement.canSendAutomaticRecovery) {
    return false;
  }
  if (entitlement.serviceStatus !== "ONBOARDING") {
    return false;
  }

  const state = await loadMctbOnboardingState(input.workspaceId);
  if (state.trialActivatedAt) return false;
  const session = state.liveTestSession;
  if (!session?.startedAt) return false;

  const forwardTargetE164 = await getProductionMctbForwardTargetE164(input.workspaceId);
  if (!forwardTargetE164 || !mctbSameE164(input.businessE164, forwardTargetE164)) {
    return false;
  }

  const config = await loadMissedCallTextConfig(input.workspaceId);
  if (!config.enabled || config.senderMode !== "PLATFORM") {
    return false;
  }

  const event = await prisma.missedCallEvent.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: {
      id: true,
      workspaceId: true,
      callerE164: true,
      businessE164: true,
      detectedAt: true,
      smsSentAt: true,
      metadata: true,
    },
  });
  if (!event || event.workspaceId !== input.workspaceId) {
    return false;
  }
  if (event.smsSentAt) {
    return false;
  }

  const since = new Date(session.startedAt);
  if (event.detectedAt < since) {
    return false;
  }

  if (session.missedCallEventId && session.missedCallEventId !== event.id) {
    return false;
  }

  const priorSent = await prisma.missedCallEvent.count({
    where: {
      workspaceId: input.workspaceId,
      businessE164: forwardTargetE164,
      smsSentAt: { not: null },
      detectedAt: { gte: since },
      id: { not: event.id },
    },
  });
  if (priorSent > 0) {
    return false;
  }

  const metadata =
    event.metadata && typeof event.metadata === "object"
      ? (event.metadata as Record<string, unknown>)
      : {};
  if (metadata.demoMode === true) {
    return false;
  }

  const forwardedFrom =
    input.forwardedFromE164?.trim() || readForwardedFrom(metadata);
  const businessLineE164 = state.businessNumberE164?.trim() || null;
  if (
    !forwardingVerifiedForLiveTest({
      forwardedFrom,
      businessLineE164,
      forwardTargetE164,
    })
  ) {
    return false;
  }

  const consentOk = await consentSatisfiedForLiveTest({
    workspaceId: input.workspaceId,
    consentMode: state.consentMode,
    callerE164: event.callerE164 || input.callerE164,
    sessionStartedAt: session.startedAt,
    sessionConsentAt: session.consentCompletedAt,
  });
  if (!consentOk) {
    return false;
  }

  return true;
}
