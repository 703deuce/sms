import "server-only";

import { getPrisma } from "@/lib/db";
import { registerVoiceV2SmsContinuation, resolveVoiceV2SmsContinuation } from "./continuation-hydration";
import { buildVoiceV2SmsContinuationBundleFromSession } from "./durable-continuation";
import { rehydrateVoiceRecoveryOfferSetForSms } from "./offer-set-rehydration";
import { findRecoverySessionForSmsContinuation } from "./session-store";
import { recordVoiceV2AiCallRecoveryAnalytics } from "./analytics";
import type { VoiceV2RecoveryStructuredState } from "./types";

export async function tryHandleVoiceV2AiCallRecoveryInboundSms(input: {
  workspaceId: string;
  conversationId: string;
  fromE164: string;
  toE164: string;
  body: string;
  providerMessageId?: string | null;
}): Promise<{ handled: boolean; reply?: string; reason?: string }> {
  const session = await findRecoverySessionForSmsContinuation({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    callerE164: input.fromE164,
    sendingE164: input.toE164,
  });
  if (!session) return { handled: false, reason: "no_active_recovery_session" };
  if (!session.continuationEnabled) return { handled: false, reason: "continuation_disabled" };

  const prisma = getPrisma();
  if (!session.callerRepliedAt) {
    await prisma.voiceV2AiCallRecoverySession.update({
      where: { id: session.id },
      data: {
        callerRepliedAt: new Date(),
        continuationStartedAt: new Date(),
        smsConversationId: input.conversationId,
      },
    });
    await recordVoiceV2AiCallRecoveryAnalytics(input.workspaceId, "caller_replied_to_recovery", {
      callId: session.voiceCallId,
      sessionId: session.id,
    });
  }

  const bundle = buildVoiceV2SmsContinuationBundleFromSession(session);
  registerVoiceV2SmsContinuation(input.conversationId, bundle);

  const structuredState = bundle.structuredState;

  await rehydrateVoiceRecoveryOfferSetForSms({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    structuredState,
    customerPhone: input.fromE164,
    customerName: structuredState.callerFields.name,
    customerEmail: structuredState.callerFields.email,
  });

  await seedLeadRecoveryCollectedFieldsFromVoice({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    structuredState,
  });

  const { handleMctbAiBookingInboundSms } = await import(
    "@/lib/mctb/ai-booking/conversation-runtime"
  );
  const booking = await handleMctbAiBookingInboundSms({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    customerPhone: input.fromE164,
    body: input.body,
    forceSchedulingRoute:
      structuredState.recoverySubtype === "BOOKING_INTERRUPTED" ||
      Boolean(structuredState.booking?.offerSetId),
    recoverySmsCallerE164: input.fromE164,
    recoverySmsBusinessE164: input.toE164,
  });

  if (booking.handled) {
    await recordVoiceV2AiCallRecoveryAnalytics(input.workspaceId, "continuation_started", {
      callId: session.voiceCallId,
    });
    return { handled: true, reply: booking.reply };
  }

  const cont = await resolveVoiceV2SmsContinuation({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    callerE164: input.fromE164,
    sendingE164: input.toE164,
  });
  if (cont) {
    const { buildMctbSemanticConversationContext } = await import(
      "@/lib/mctb/semantic-conversation-context"
    );
    await buildMctbSemanticConversationContext({
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      latestCustomerMessage: input.body,
      recoverySmsCallerE164: input.fromE164,
      recoverySmsBusinessE164: input.toE164,
    });
  }

  return { handled: false, reason: "text_agent_not_handled" };
}

async function seedLeadRecoveryCollectedFieldsFromVoice(input: {
  workspaceId: string;
  conversationId: string;
  structuredState: VoiceV2RecoveryStructuredState;
}) {
  const { loadLeadRecoveryState, saveLeadRecoveryState } = await import(
    "@/lib/mctb/lead-recovery/state-store"
  );
  const state = await loadLeadRecoveryState({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
  });
  const collected = { ...state.collectedFields };
  for (const [k, v] of Object.entries(input.structuredState.callerFields)) {
    if (v?.trim()) collected[k] = v;
  }
  for (const [k, v] of Object.entries(input.structuredState.customFields)) {
    if (v?.trim()) collected[k] = v;
  }
  state.collectedFields = collected;
  await saveLeadRecoveryState(state);
}
