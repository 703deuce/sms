import "server-only";

import { getMctbDurableOperationStore } from "./store";
import { buildVoiceOperationIdempotencyKey, createOrResolveDurableOperation } from "./create";
import { resolveVoiceOperationResponse } from "./resolve-status";
import { pickInitialHoldingPhrase } from "./holding";
import type { VoiceOperationVoiceResult } from "./types";
import { voiceBookingConversationId } from "@/lib/voice/ai-booking/constants";

export async function startVoiceAiBookingDurableOperation(input: {
  workspaceId: string;
  agentId?: string | null;
  callId: string;
  utterance: string;
  confirmBooking?: boolean;
  offeredSlotId?: string | null;
  externalInvocationId?: string | null;
  actionEpochAtEnqueue?: number | null;
}): Promise<VoiceOperationVoiceResult> {
  const { resolveVoiceBookingMode } = await import("@/lib/voice/ai-booking/mode");
  const mode = await resolveVoiceBookingMode({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
  });
  if (mode !== "AI_BOOK") {
    return {
      ok: false,
      status: "FAILED_TERMINAL",
      operationId: "",
      speak:
        "I can text you our booking link to schedule, if you'd like — just say you'd like the link by text.",
      error: "voice_ai_booking_not_active",
      data: { resolvedMode: mode },
    };
  }

  const { evaluateMctbAiBookingReadiness } = await import("@/lib/mctb/ai-booking/readiness");
  const readiness = await evaluateMctbAiBookingReadiness(input.workspaceId);
  if (!readiness.ready) {
    return {
      ok: false,
      status: "FAILED_TERMINAL",
      operationId: "",
      speak:
        "I'm not able to check live calendar availability on this call right now. I can take your preferred time and have someone call you back to confirm.",
      error: `ai_booking_not_ready:${readiness.reason || "not_ready"}`,
    };
  }

  const idempotencyKey = buildVoiceOperationIdempotencyKey({
    voiceCallId: input.callId,
    operationType: "VOICE_AI_BOOKING_TURN",
    utterance: input.utterance,
    offeredSlotId: input.offeredSlotId,
    confirmBooking: input.confirmBooking,
    externalInvocationId: input.externalInvocationId,
  });

  const conversationId = voiceBookingConversationId(input.callId);
  const { operation } = await createOrResolveDurableOperation({
    workspaceId: input.workspaceId,
    conversationId,
    voiceCallId: input.callId,
    operationType: "VOICE_AI_BOOKING_TURN",
    stateVersion: input.actionEpochAtEnqueue ?? null,
    idempotencyKey,
    inputJson: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callId: input.callId,
      conversationId,
      utterance: input.utterance,
      confirmBooking: input.confirmBooking === true,
      offeredSlotId: input.offeredSlotId,
      actionEpochAtEnqueue: input.actionEpochAtEnqueue ?? null,
    },
  });

  const holding = pickInitialHoldingPhrase(operation.id);
  const resolved = resolveVoiceOperationResponse(operation);
  if (resolved.status === "SUCCEEDED" || resolved.status === "FAILED_TERMINAL") {
    return resolved;
  }

  return {
    ok: true,
    status: "PROCESSING",
    operationId: operation.id,
    speak: holding,
    data: {
      status: "PROCESSING",
      operation_id: operation.id,
      operationId: operation.id,
      customerSafeHoldingInstruction: holding,
      processing: true,
    },
  };
}

export async function checkVoiceDurableOperation(input: {
  workspaceId: string;
  operationId: string;
}): Promise<VoiceOperationVoiceResult> {
  const store = getMctbDurableOperationStore();
  const operation = await store.findById(input.operationId);
  if (!operation || operation.workspaceId !== input.workspaceId) {
    return {
      ok: false,
      status: "FAILED_TERMINAL",
      operationId: input.operationId,
      speak: "I lost track of that request. Could you say that again?",
      error: "operation_not_found",
    };
  }
  return resolveVoiceOperationResponse(operation);
}
