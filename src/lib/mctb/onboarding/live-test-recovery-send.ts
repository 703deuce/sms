import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { getMctbEntitlement } from "@/lib/mctb/entitlement";
import { mctbDidE164Variants } from "@/lib/mctb/messaging/caller-e164";
import {
  evaluateMctbLiveTestForwardingVerified,
  isMctbLiveTestCallBusinessE164,
  MCTB_LIVE_TEST_SESSION_LOOKBACK_MS,
  readMctbLiveTestForwardedFrom,
} from "@/lib/mctb/onboarding/live-test-forwarding";
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
  const since = new Date(
    new Date(input.sessionStartedAt).getTime() - MCTB_LIVE_TEST_SESSION_LOOKBACK_MS,
  );
  const { mctbCallerE164Variants } = await import("@/lib/mctb/messaging/caller-e164");
  const callerVariants = mctbCallerE164Variants(input.callerE164);
  const consentEvent = await prisma.smartRoutingSmsConsentEvent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      callerNumber: { in: callerVariants },
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
  const businessLineE164 = state.businessNumberE164?.trim() || null;
  if (
    !forwardTargetE164 ||
    !isMctbLiveTestCallBusinessE164({
      businessE164: input.businessE164,
      forwardTargetE164,
      businessLineE164,
    })
  ) {
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

  const since = new Date(
    new Date(session.startedAt).getTime() - MCTB_LIVE_TEST_SESSION_LOOKBACK_MS,
  );
  if (event.detectedAt < since) {
    return false;
  }

  if (session.missedCallEventId && session.missedCallEventId !== event.id) {
    const locked = await prisma.missedCallEvent.findUnique({
      where: { id: session.missedCallEventId },
      select: { smsSentAt: true, workspaceId: true },
    });
    if (locked?.workspaceId === input.workspaceId && locked.smsSentAt) {
      return false;
    }
  }

  const businessE164Filter = businessLineE164
    ? mctbDidE164Variants(businessLineE164).map((e164) => ({ businessE164: e164 }))
    : [];
  const priorSent = await prisma.missedCallEvent.count({
    where: {
      workspaceId: input.workspaceId,
      OR: [{ businessE164: forwardTargetE164 }, ...businessE164Filter],
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
    input.forwardedFromE164?.trim() || readMctbLiveTestForwardedFrom(metadata);
  if (
    !evaluateMctbLiveTestForwardingVerified({
      businessE164: event.businessE164,
      forwardedFrom,
      forwardTargetE164,
      businessLineE164,
      allowIngressWithoutForwardHeader: true,
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
