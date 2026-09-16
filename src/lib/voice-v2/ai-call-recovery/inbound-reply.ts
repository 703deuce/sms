import "server-only";

import { getPrisma } from "@/lib/db";
import {
  getVoiceV2SmsContinuation,
  mergeVoiceContinuationIntoConversationTurns,
  registerVoiceV2SmsContinuation,
} from "./continuation-hydration";
import { findActiveRecoverySessionForInbound } from "./session-store";
import { recordVoiceV2AiCallRecoveryAnalytics } from "./analytics";
import type { VoiceV2RecoveryStructuredState, VoiceV2RecoveryTranscriptTurn } from "./types";

export async function tryHandleVoiceV2AiCallRecoveryInboundSms(input: {
  workspaceId: string;
  conversationId: string;
  fromE164: string;
  toE164: string;
  body: string;
  providerMessageId?: string | null;
}): Promise<{ handled: boolean; reply?: string; reason?: string }> {
  const session = await findActiveRecoverySessionForInbound({
    workspaceId: input.workspaceId,
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

  const structuredState = session.structuredState as VoiceV2RecoveryStructuredState;
  const voiceTranscript = (session.voiceTranscriptTurns || []) as VoiceV2RecoveryTranscriptTurn[];
  const actionTimeline = (session.actionTimeline || []) as Array<{ kind: string; summary: string }>;

  registerVoiceV2SmsContinuation(input.conversationId, {
    continuationSource: "VOICE_CALL",
    sourceVoiceCallId: session.voiceCallId,
    recoverySessionId: session.id,
    structuredState,
    voiceTranscript,
    actionTimeline,
    callSummary: session.callSummary,
  });

  await seedAiBookingSessionFromVoiceState({
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
  });

  if (booking.handled) {
    await recordVoiceV2AiCallRecoveryAnalytics(input.workspaceId, "continuation_started", {
      callId: session.voiceCallId,
    });
    return { handled: true, reply: booking.reply };
  }

  const cont = getVoiceV2SmsContinuation(input.conversationId);
  if (cont) {
    const { buildMctbSemanticConversationContext } = await import(
      "@/lib/mctb/semantic-conversation-context"
    );
    const ctx = await buildMctbSemanticConversationContext({
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      latestCustomerMessage: input.body,
    });
    mergeVoiceContinuationIntoConversationTurns({
      voiceTurns: cont.voiceTranscript,
      smsTurns: ctx.conversation,
    });
  }

  return { handled: false, reason: "text_agent_not_handled" };
}

async function seedAiBookingSessionFromVoiceState(input: {
  workspaceId: string;
  conversationId: string;
  structuredState: VoiceV2RecoveryStructuredState;
}) {
  const booking = input.structuredState.booking;
  if (!booking?.offerSetId) return;
  const { getMctbAiBookingSessionStore } = await import("@/lib/mctb/ai-booking/session-store");
  const store = getMctbAiBookingSessionStore();
  const existing = await store.get(input.conversationId);
  if (existing?.offeredSlots?.length) return;

  const provider =
    booking.strategy === "CALENDLY"
      ? "calendly"
      : booking.strategy === "MICROSOFT_365"
        ? "microsoft"
        : "microsoft";

  await store.save({
    conversationId: input.conversationId,
    workspaceId: input.workspaceId,
    provider,
    offerSetId: booking.offerSetId,
    bookingTimezone: "America/New_York",
    stage: "AWAITING_SLOT_SELECTION",
    offeredSlots: [],
    pendingSlotId: booking.selectedSlotId ?? null,
    updatedAt: new Date().toISOString(),
  });
}
