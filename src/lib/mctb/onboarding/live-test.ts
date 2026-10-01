import { getPrisma } from "@/lib/db";
import { mctbSameE164 } from "@/lib/mctb/phone/e164-match";
import { isPlatformDemoNumber } from "./demo";
import { loadMctbOnboardingState, recordFunnelEvent, saveMctbOnboardingState } from "./state";
import { getProductionMctbForwardTargetE164 } from "./phone-numbers";

export type LiveTestChecks = {
  callDetected: boolean;
  /** CFNA path: forwarded-from matches workspace business line when configured. */
  forwardingVerified: boolean;
  missedCall: boolean;
  consentCompleted: boolean;
  textSent: boolean;
  textDelivered: boolean;
  replyReceived: boolean;
};

export type LiveTestStatus = {
  started: boolean;
  passed: boolean;
  checks: LiveTestChecks;
  /** Platform ingress customers forward to during onboarding. */
  forwardTargetE164: string | null;
  /** @deprecated use forwardTargetE164 */
  trialNumberE164: string | null;
  businessNumberE164: string | null;
};

function readForwardedFrom(metadata: Record<string, unknown>): string | null {
  const raw = metadata.forwardedFrom;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function evaluateMissedCallForLiveTest(input: {
  event: {
    id: string;
    callerE164: string | null;
    reason: string;
    status: string;
    smsSentAt: Date | null;
    metadata: unknown;
  };
  forwardTargetE164: string;
  businessLineE164: string | null;
}): { callDetected: boolean; forwardingVerified: boolean; missedCall: boolean; textSent: boolean } {
  const meta =
    input.event.metadata && typeof input.event.metadata === "object"
      ? (input.event.metadata as Record<string, unknown>)
      : {};
  const forwardedFrom = readForwardedFrom(meta);

  const callDetected = true;
  let forwardingVerified = true;
  if (input.businessLineE164?.trim()) {
    forwardingVerified = Boolean(
      forwardedFrom && mctbSameE164(forwardedFrom, input.businessLineE164),
    );
  } else if (forwardedFrom) {
    forwardingVerified = !mctbSameE164(forwardedFrom, input.forwardTargetE164);
  }

  const missedCall =
    ["missed_no_answer", "missed_busy", "voicemail"].includes(input.event.reason) ||
    input.event.status !== "SUPPRESSED";
  const textSent = Boolean(input.event.smsSentAt || input.event.status === "SENT");

  return { callDetected, forwardingVerified, missedCall, textSent };
}

export async function startLiveTestSession(workspaceId: string): Promise<void> {
  const state = await loadMctbOnboardingState(workspaceId);
  if (state.liveTestSession?.startedAt) return;

  await saveMctbOnboardingState(workspaceId, {
    liveTestSession: {
      startedAt: new Date().toISOString(),
      businessNumberE164: state.businessNumberE164,
    },
    currentStep: "review_test",
  });
  const forwardTargetE164 = await getProductionMctbForwardTargetE164(workspaceId);
  await recordFunnelEvent(workspaceId, "MCTB_LIVE_TEST_STARTED", {
    businessNumberE164: state.businessNumberE164,
    forwardTargetE164,
  });
}

/** Auto-detect live test progress from real missed-call events on the workspace ingress. */
export async function getLiveTestStatus(workspaceId: string): Promise<LiveTestStatus> {
  const state = await loadMctbOnboardingState(workspaceId);
  const forwardTargetE164 = await getProductionMctbForwardTargetE164(workspaceId);
  const businessLineE164 = state.businessNumberE164?.trim() || null;
  const session = state.liveTestSession;
  const started = Boolean(session?.startedAt);

  const emptyChecks: LiveTestChecks = {
    callDetected: false,
    forwardingVerified: false,
    missedCall: false,
    consentCompleted: false,
    textSent: false,
    textDelivered: false,
    replyReceived: false,
  };

  const empty: LiveTestStatus = {
    started,
    passed: Boolean(state.liveTestPassedAt),
    checks: emptyChecks,
    forwardTargetE164,
    trialNumberE164: forwardTargetE164,
    businessNumberE164: businessLineE164,
  };

  if (!started) return empty;

  if (state.liveTestPassedAt) {
    const sessionChecks = state.liveTestSession;
    return {
      ...empty,
      passed: true,
      checks: {
        callDetected: Boolean(sessionChecks?.callDetectedAt),
        forwardingVerified: Boolean(sessionChecks?.forwardingVerifiedAt || sessionChecks?.callDetectedAt),
        missedCall: Boolean(sessionChecks?.missedCallAt),
        consentCompleted: Boolean(sessionChecks?.consentCompletedAt || state.consentMode === "existing_consent"),
        textSent: Boolean(sessionChecks?.textSentAt),
        textDelivered: Boolean(sessionChecks?.textSentAt),
        replyReceived: Boolean(sessionChecks?.replyReceivedAt),
      },
    };
  }

  if (!forwardTargetE164 || !session?.startedAt) return empty;

  const prisma = getPrisma();
  const since = new Date(session.startedAt);

  const event = await prisma.missedCallEvent.findFirst({
    where: {
      workspaceId,
      detectedAt: { gte: since },
      businessE164: forwardTargetE164,
    },
    orderBy: { detectedAt: "desc" },
  });

  if (!event) return empty;

  const metadata =
    event.metadata && typeof event.metadata === "object"
      ? (event.metadata as Record<string, unknown>)
      : {};
  const isDemoOnly =
    metadata.demoMode === true &&
    isPlatformDemoNumber(event.businessE164) &&
    !state.liveTestSession?.startedAt;
  if (isDemoOnly) return empty;

  const evaluated = evaluateMissedCallForLiveTest({
    event,
    forwardTargetE164,
    businessLineE164,
  });

  if (!evaluated.forwardingVerified) {
    return {
      ...empty,
      checks: {
        ...emptyChecks,
        callDetected: evaluated.callDetected,
        forwardingVerified: false,
      },
    };
  }

  const textDelivered = evaluated.textSent;

  let replyReceived = Boolean(session?.replyReceivedAt);
  if (!replyReceived && evaluated.textSent && event.smsSentAt) {
    const contact = await prisma.contact.findFirst({
      where: { workspaceId, phone: event.callerE164 },
      select: { id: true },
    });
    if (contact) {
      const reply = await prisma.conversationMessage.findFirst({
        where: {
          direction: "inbound",
          createdAt: { gte: event.smsSentAt },
          conversation: { workspaceId, contactId: contact.id },
        },
        orderBy: { createdAt: "desc" },
      });
      replyReceived = Boolean(reply);
    }
  }

  let consentCompleted = state.consentMode === "existing_consent";
  if (!consentCompleted && state.consentMode === "press_1") {
    const consentEvent = await prisma.smartRoutingSmsConsentEvent.findFirst({
      where: {
        workspaceId,
        callerNumber: event.callerE164,
        consentedAt: { gte: since },
      },
      orderBy: { consentedAt: "desc" },
    });
    consentCompleted = Boolean(consentEvent || session?.consentCompletedAt);
  } else if (!consentCompleted) {
    consentCompleted = Boolean(session?.consentCompletedAt);
  }

  const passed =
    evaluated.forwardingVerified &&
    evaluated.missedCall &&
    consentCompleted &&
    evaluated.textSent &&
    replyReceived;

  const nowIso = new Date().toISOString();
  const sessionPatch = {
    ...session!,
    callDetectedAt: session?.callDetectedAt || event.detectedAt.toISOString(),
    forwardingVerifiedAt: session?.forwardingVerifiedAt || nowIso,
    missedCallAt: session?.missedCallAt || event.detectedAt.toISOString(),
    textSentAt: event.smsSentAt?.toISOString() || session?.textSentAt,
    replyReceivedAt: replyReceived ? session?.replyReceivedAt || nowIso : session?.replyReceivedAt,
    consentCompletedAt:
      consentCompleted && !session?.consentCompletedAt ? nowIso : session?.consentCompletedAt,
    missedCallEventId: event.id,
  };

  if (passed && !state.liveTestPassedAt) {
    await saveMctbOnboardingState(workspaceId, { liveTestSession: sessionPatch });
    await markLiveTestPassed(workspaceId, event.id);
  } else if (event.id !== session?.missedCallEventId) {
    await saveMctbOnboardingState(workspaceId, { liveTestSession: sessionPatch });
  }

  return {
    started,
    passed: passed || Boolean(state.liveTestPassedAt),
    checks: {
      callDetected: evaluated.callDetected,
      forwardingVerified: evaluated.forwardingVerified,
      missedCall: evaluated.missedCall,
      consentCompleted,
      textSent: evaluated.textSent,
      textDelivered,
      replyReceived,
    },
    forwardTargetE164,
    trialNumberE164: forwardTargetE164,
    businessNumberE164: businessLineE164,
  };
}

export async function markLiveTestPassed(
  workspaceId: string,
  missedCallEventId?: string,
): Promise<void> {
  const state = await loadMctbOnboardingState(workspaceId);
  if (state.liveTestPassedAt) return;

  const session = state.liveTestSession;
  if (!session?.textSentAt || !session.replyReceivedAt) {
    return;
  }

  const now = new Date().toISOString();
  await saveMctbOnboardingState(workspaceId, {
    liveTestPassedAt: now,
    liveTestSession: {
      ...(session || { startedAt: now }),
      passedAt: now,
      missedCallEventId: missedCallEventId || session?.missedCallEventId,
    },
    currentStep: "ready",
    trialActivationLastError: null,
  });
  await recordFunnelEvent(workspaceId, "MCTB_LIVE_TEST_PASSED", { missedCallEventId });

  const { activateMctbTrial } = await import("./trial");
  const activation = await activateMctbTrial(workspaceId);
  if (!activation.ok) {
    await saveMctbOnboardingState(workspaceId, {
      trialActivationLastError: activation.reason || "activation_failed",
      trialActivationPendingAt: now,
    });
  }
}
