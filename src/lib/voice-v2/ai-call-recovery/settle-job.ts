import "server-only";

import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { getPrisma } from "@/lib/db";
import { fetchVoiceV2L2ContextBundle } from "../session/call-context-store";
import { resolveVoiceV2PrimaryOutcome } from "../primary-outcome";
import { buildVoiceV2RecoveryActionTimeline } from "./action-timeline";
import { loadVoiceV2AiCallRecoveryConfigForAgent } from "./config";
import { checkRecoveryMessagingEligibility } from "./eligibility";
import { evaluateAiCallRecovery } from "./evaluate";
import { hasPartialIntakeEvidence } from "./pinned-schema-snapshot";
import { resolveVoiceV2ResolutionStatus } from "./resolution-status";
import { buildVoiceV2RecoveryStructuredState } from "./structured-state";
import { renderRecoveryTemplate } from "./templates";
import { loadVoiceTranscriptTurnsForCall } from "./transcript-turns";
import {
  VOICE_V2_AI_CALL_RECOVERY_SETTLE_MS_MIN,
  VOICE_V2_AI_CALL_RECOVERY_SETTLE_MS_MAX,
} from "./types";
import { recordVoiceV2AiCallRecoveryAnalytics } from "./analytics";
import { sendVoiceV2AiCallRecoverySms } from "./send-recovery-sms";
import { findActiveRecoveryCooldown } from "./session-store";

export const VOICE_V2_AI_CALL_RECOVERY_SETTLE_JOB = "voice_v2_ai_call_recovery_settle";

export async function enqueueVoiceV2AiCallRecoverySettle(input: {
  workspaceId: string;
  callId: string;
  agentId?: string | null;
  agentVersionId?: string | null;
  delaySeconds?: number;
}) {
  const span = VOICE_V2_AI_CALL_RECOVERY_SETTLE_MS_MAX - VOICE_V2_AI_CALL_RECOVERY_SETTLE_MS_MIN;
  const delayMs =
    VOICE_V2_AI_CALL_RECOVERY_SETTLE_MS_MIN + Math.floor(Math.random() * Math.max(1, span));
  const extraDelayMs = Math.max(0, (input.delaySeconds ?? 0) * 1000);
  const runAfter = new Date(Date.now() + delayMs + extraDelayMs);

  await enqueueJob({
    workspaceId: input.workspaceId,
    jobType: VOICE_V2_AI_CALL_RECOVERY_SETTLE_JOB,
    payload: {
      callId: input.callId,
      agentId: input.agentId ?? null,
      agentVersionId: input.agentVersionId ?? null,
    },
    idempotencyKey: `voice-v2-acr-settle:${input.callId}`,
    runAfter,
  });
}

export async function executeVoiceV2AiCallRecoverySettleJob(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const callId = String(payload.callId || "");
  if (!callId) throw new Error("voice_v2_acr_call_id_required");

  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: callId },
    select: {
      id: true,
      workspaceId: true,
      agentId: true,
      agentVersionId: true,
      fromE164: true,
      isTest: true,
      durationSeconds: true,
      metadata: true,
      telnyxConversationId: true,
    },
  });
  if (!call) return { ok: false, reason: "call_not_found" };

  const meta =
    call.metadata && typeof call.metadata === "object" && !Array.isArray(call.metadata)
      ? (call.metadata as Record<string, unknown>)
      : {};

  if (meta.voiceV2AiCallRecoverySent === true) {
    return { ok: true, skipped: true, reason: "already_sent" };
  }

  const config = await loadVoiceV2AiCallRecoveryConfigForAgent({
    workspaceId: call.workspaceId,
    agentId: call.agentId,
    agentVersionId: call.agentVersionId,
  });

  if (!config.enabled) {
    return { ok: true, skipped: true, reason: "disabled" };
  }

  const canonical = `call:${call.id}`;
  const bundle = await fetchVoiceV2L2ContextBundle(canonical);
  const ctx = bundle.record?.payload ?? null;

  if (ctx?.bookingWorkflow?.bookingConfirmed) {
    await recordVoiceV2AiCallRecoveryAnalytics(call.workspaceId, "recovery_suppressed", {
      callId,
      reason: "booking_confirmed_after_settle",
    });
    return { ok: true, skipped: true, reason: "booking_confirmed_after_settle" };
  }

  const primaryOutcome = ctx ? resolveVoiceV2PrimaryOutcome(ctx) : "NONE";
  const resolutionStatus = resolveVoiceV2ResolutionStatus({
    ctx,
    callMeta: {
      declinedAiChannel: meta.voiceV2DeclinedAiChannel === true,
      informationOnlyResolved: meta.voiceV2InformationOnlyResolved === true,
      providerFailure: meta.voiceV2ProviderFailure === true,
      isSpam: meta.voiceV2SpamCall === true,
    },
    durationSeconds: call.durationSeconds ?? undefined,
  });

  const pinnedSchema = ctx ? buildVoiceV2RecoveryStructuredState({ ctx, resolutionStatus }).pinnedSchema : undefined;
  const partialIntakeEvidence = pinnedSchema ? hasPartialIntakeEvidence(pinnedSchema) : false;

  const existingSession = await prisma.voiceV2AiCallRecoverySession.findFirst({
    where: { voiceCallId: call.id },
    select: { id: true, recoverySmsSentAt: true },
  });
  if (existingSession?.recoverySmsSentAt) {
    return { ok: true, skipped: true, reason: "session_already_sent" };
  }

  const cooldown = await findActiveRecoveryCooldown({
    workspaceId: call.workspaceId,
    callerE164: call.fromE164,
    cooldownSeconds: config.recoveryCooldownSeconds ?? 900,
  });

  const eligibility = await checkRecoveryMessagingEligibility({
    workspaceId: call.workspaceId,
    callerE164: call.fromE164,
    sendingPhoneNumberId: config.sendingPhoneNumberId,
    consentMode: config.consentMode,
  });

  const evaluation = evaluateAiCallRecovery({
    callState: {
      isTest: call.isTest,
      isSpam: meta.voiceV2SpamCall === true,
      durationSeconds: call.durationSeconds ?? undefined,
      declinedAiChannel: meta.voiceV2DeclinedAiChannel === true,
      informationOnlyResolved: meta.voiceV2InformationOnlyResolved === true,
    },
    resolutionStatus,
    primaryOutcome,
    bookingState: ctx
      ? {
          offerSetId: ctx.currentOfferSet?.offerSetId,
          selectedSlotId: ctx.bookingState?.selectedSlotId,
          bookingStatus: ctx.bookingWorkflow?.bookingConfirmed ? "CONFIRMED" : undefined,
          strategy: ctx.capabilities?.bookingStrategy,
        }
      : undefined,
    transferState: ctx?.afterHours?.transfer
      ? {
          status: ctx.afterHours.transfer.status,
          bridgeSucceeded: ctx.afterHours.transfer.status === "SUCCEEDED",
        }
      : undefined,
    callbackState: {
      created: Boolean(
        ctx?.afterHours?.callback?.finalizedAt || ctx?.bookingWorkflow?.callbackRequested,
      ),
      success: Boolean(ctx?.afterHours?.callback?.finalizedAt),
    },
    callerSpeechState: {
      meaningfulUtteranceCount: meta.voiceV2MeaningfulUtterances as number | undefined,
    },
    messagingEligibility: {
      recoveryEnabled: config.enabled,
      consentMode: config.consentMode,
      validDestination: eligibility.validDestination,
      validSendingRoute: eligibility.validSendingRoute,
      notOptedOut: eligibility.notOptedOut,
      notSuppressed: eligibility.notSuppressed,
      callerIdKnown: eligibility.callerIdKnown,
      recoveryAlreadySent: Boolean(existingSession?.recoverySmsSentAt),
      activeRecoveryCooldown: cooldown.active,
      landlineOrNonSmsDestination: eligibility.landlineOrNonSmsDestination,
    },
    pinnedConfig: config,
    triggers: config.triggers,
    sendWhenCallbackAlreadyCreated: config.sendWhenCallbackAlreadyCreated,
    partialIntakeEvidence,
    providerFailureAuthoritative: meta.voiceV2ProviderFailure === true,
    bookingPendingAtHangup:
      ctx?.bookingWorkflow?.nextStage === "BOOK_SELECTED_SLOT" ||
      Boolean(ctx?.bookingState?.selectedSlotId),
  });

  if (evaluation.delivery === "NO_SMS") {
    await recordVoiceV2AiCallRecoveryAnalytics(call.workspaceId, "recovery_suppressed", {
      callId,
      reason: evaluation.reason,
    });
    return { ok: true, skipped: true, reason: evaluation.reason };
  }

  if (evaluation.delivery === "SEND_CALLBACK_ACK_SMS") {
    const { sendVoiceV2CallbackAckSms } = await import("./send-callback-ack-sms");
    const ack = await sendVoiceV2CallbackAckSms({
      workspaceId: call.workspaceId,
      callId: call.id,
      agentId: call.agentId,
      callerE164: call.fromE164,
      sendingPhoneNumberId: config.sendingPhoneNumberId,
      sendingE164: eligibility.sendingE164,
    });
    if (!ack.ok) {
      await recordVoiceV2AiCallRecoveryAnalytics(call.workspaceId, "recovery_suppressed", {
        callId,
        reason: ack.reason,
      });
      return { ok: true, skipped: true, reason: ack.reason };
    }
    await recordVoiceV2AiCallRecoveryAnalytics(call.workspaceId, "callback_ack_sent", {
      callId,
    });
    return { ok: true, sent: true, delivery: "SEND_CALLBACK_ACK_SMS" };
  }

  const subtype = evaluation.recoverySubtype ?? "GENERAL_UNRESOLVED";
  const transcriptTurns = await loadVoiceTranscriptTurnsForCall({
    workspaceId: call.workspaceId,
    callId: call.id,
  });
  const structuredState = ctx
    ? buildVoiceV2RecoveryStructuredState({ ctx, resolutionStatus, recoverySubtype: subtype })
    : {
        primaryOutcome,
        resolutionStatus,
        recoverySubtype: subtype,
        callerFields: {},
        customFields: {},
      };

  const templateBody = renderRecoveryTemplate({
    subtype,
    templates: config.templates,
    variables: {
      caller_first_name: structuredState.callerFields.name?.split(/\s+/)[0] || "",
      service: structuredState.callerFields.service_reason || "",
      business_name: String(meta.businessName || ""),
    },
  });

  const idempotencyKey = `voice-v2-acr-send:${call.id}`;
  const sendResult = await sendVoiceV2AiCallRecoverySms({
    workspaceId: call.workspaceId,
    callId: call.id,
    agentId: call.agentId,
    callerE164: call.fromE164,
    sendingPhoneNumberId: config.sendingPhoneNumberId,
    sendingE164: eligibility.sendingE164,
    body: templateBody,
    idempotencyKey,
  });

  if (!sendResult.ok) {
    await recordVoiceV2AiCallRecoveryAnalytics(call.workspaceId, "recovery_send_failed", {
      callId,
      reason: sendResult.reason,
    });
    return { ok: false, reason: sendResult.reason };
  }

  const actionTimeline = buildVoiceV2RecoveryActionTimeline(ctx);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.voiceV2AiCallRecoverySession.upsert({
    where: { recoveryIdempotencyKey: idempotencyKey },
    create: {
      workspaceId: call.workspaceId,
      voiceCallId: call.id,
      agentId: call.agentId,
      callerE164: call.fromE164,
      sendingPhoneNumberId: config.sendingPhoneNumberId,
      sendingE164: eligibility.sendingE164,
      resolutionStatus,
      primaryOutcome,
      deliveryDecision: evaluation.delivery,
      recoverySubtype: subtype,
      continuationEnabled: config.continueOverSms,
      structuredState: structuredState as object,
      voiceTranscriptTurns: transcriptTurns as object,
      actionTimeline: actionTimeline as object,
      callSummary: typeof meta.voiceV2CallSummary === "string" ? meta.voiceV2CallSummary : null,
      smsConversationId: sendResult.conversationId,
      recoverySmsSentAt: new Date(),
      recoverySmsStatus: "sent",
      recoveryIdempotencyKey: idempotencyKey,
      expiresAt,
    },
    update: {
      recoverySmsSentAt: new Date(),
      recoverySmsStatus: "sent",
      smsConversationId: sendResult.conversationId,
    },
  });

  await prisma.voiceCall.update({
    where: { id: call.id },
    data: {
      metadata: {
        ...meta,
        voiceV2AiCallRecoverySent: true,
        voiceV2ResolutionStatus: resolutionStatus,
        voiceV2RecoverySubtype: subtype,
      },
    },
  });

  await recordVoiceV2AiCallRecoveryAnalytics(call.workspaceId, "recovery_sms_sent", {
    callId,
    subtype,
  });

  return { ok: true, sent: true, subtype, conversationId: sendResult.conversationId };
}
