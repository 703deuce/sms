import { getPrisma } from "@/lib/db";
import { isPlatformDemoNumber } from "./demo";
import { loadMctbOnboardingState, recordFunnelEvent, saveMctbOnboardingState } from "./state";

export type LiveTestChecks = {
  callDetected: boolean;
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
  trialNumberE164: string | null;
  businessNumberE164: string | null;
};

export async function startLiveTestSession(workspaceId: string): Promise<void> {
  const state = await loadMctbOnboardingState(workspaceId);
  if (state.liveTestSession?.startedAt) return;

  await saveMctbOnboardingState(workspaceId, {
    liveTestSession: {
      startedAt: new Date().toISOString(),
      businessNumberE164: state.businessNumberE164,
    },
    currentStep: "live_test",
  });
  await recordFunnelEvent(workspaceId, "MCTB_LIVE_TEST_STARTED", {
    businessNumberE164: state.businessNumberE164,
    trialNumberE164: state.trialNumber?.e164,
  });
}

/** Auto-detect live test progress on the customer's assigned trial toll-free number. */
export async function getLiveTestStatus(workspaceId: string): Promise<LiveTestStatus> {
  const state = await loadMctbOnboardingState(workspaceId);
  const trialE164 = state.trialNumber?.e164 || null;
  const trialPhoneNumberId = state.trialNumber?.phoneNumberId || null;
  const session = state.liveTestSession;
  const started = Boolean(session?.startedAt);

  const empty: LiveTestStatus = {
    started,
    passed: Boolean(state.liveTestPassedAt),
    checks: {
      callDetected: false,
      missedCall: false,
      consentCompleted: false,
      textSent: false,
      textDelivered: false,
      replyReceived: false,
    },
    trialNumberE164: trialE164,
    businessNumberE164: state.businessNumberE164 || null,
  };

  if (!started || !trialPhoneNumberId || state.liveTestPassedAt) {
    if (state.liveTestPassedAt) {
      return {
        ...empty,
        passed: true,
        checks: {
          callDetected: true,
          missedCall: true,
          consentCompleted: true,
          textSent: true,
          textDelivered: true,
          replyReceived: true,
        },
      };
    }
    return empty;
  }

  const prisma = getPrisma();
  const since = new Date(session!.startedAt);

  const event = await prisma.missedCallEvent.findFirst({
    where: {
      workspaceId,
      phoneNumberId: trialPhoneNumberId,
      detectedAt: { gte: since },
      businessE164: trialE164 || undefined,
    },
    orderBy: { detectedAt: "desc" },
  });

  if (!event) return empty;

  const metadata =
    event.metadata && typeof event.metadata === "object"
      ? (event.metadata as Record<string, unknown>)
      : {};
  const isDemo = metadata.demoMode === true || isPlatformDemoNumber(event.businessE164);
  if (isDemo) return empty;

  const callDetected = true;
  const missedCall = ["missed_no_answer", "missed_busy", "voicemail"].includes(event.reason) ||
    event.status !== "SUPPRESSED";
  const textSent = Boolean(event.smsSentAt || event.status === "SENT");
  const textDelivered = textSent;

  let replyReceived = Boolean(session?.replyReceivedAt);
  if (!replyReceived && textSent && event.smsSentAt) {
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

  const consentCompleted =
    state.consentMode === "existing_consent" ||
    Boolean(session?.consentCompletedAt) ||
    missedCall;

  const passed = missedCall && textDelivered && replyReceived;

  if (passed && !state.liveTestPassedAt) {
    await markLiveTestPassed(workspaceId, event.id);
  } else if (event.id !== session?.missedCallEventId) {
    await saveMctbOnboardingState(workspaceId, {
      liveTestSession: {
        ...session!,
        callDetectedAt: event.detectedAt.toISOString(),
        missedCallAt: event.detectedAt.toISOString(),
        textSentAt: event.smsSentAt?.toISOString() || session?.textSentAt,
        replyReceivedAt: replyReceived
          ? new Date().toISOString()
          : session?.replyReceivedAt,
        missedCallEventId: event.id,
      },
    });
  }

  return {
    started,
    passed: passed || Boolean(state.liveTestPassedAt),
    checks: {
      callDetected,
      missedCall,
      consentCompleted,
      textSent,
      textDelivered,
      replyReceived,
    },
    trialNumberE164: trialE164,
    businessNumberE164: state.businessNumberE164 || null,
  };
}

export async function markLiveTestPassed(
  workspaceId: string,
  missedCallEventId?: string,
): Promise<void> {
  const state = await loadMctbOnboardingState(workspaceId);
  if (state.liveTestPassedAt) return;

  const now = new Date().toISOString();
  await saveMctbOnboardingState(workspaceId, {
    liveTestPassedAt: now,
    liveTestSession: {
      ...(state.liveTestSession || { startedAt: now }),
      passedAt: now,
      missedCallEventId: missedCallEventId || state.liveTestSession?.missedCallEventId,
      replyReceivedAt: state.liveTestSession?.replyReceivedAt || now,
      textSentAt: state.liveTestSession?.textSentAt || now,
      missedCallAt: state.liveTestSession?.missedCallAt || now,
      callDetectedAt: state.liveTestSession?.callDetectedAt || now,
    },
    currentStep: "complete",
  });
  await recordFunnelEvent(workspaceId, "MCTB_LIVE_TEST_PASSED", { missedCallEventId });

  const { activateMctbTrial } = await import("./trial");
  await activateMctbTrial(workspaceId);
}
