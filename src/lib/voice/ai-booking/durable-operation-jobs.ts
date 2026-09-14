import "server-only";

import { getMctbDurableOperationStore } from "@/lib/mctb/durable-operations/store";
import {
  deliverVoiceOperationIfReady,
  expireVoiceOperationFallback,
  speakHoldTierOnCall,
} from "@/lib/voice/ai-booking/durable-operation-delivery";
import { holdPhraseForTier, isOperationInFlight } from "@/lib/voice/ai-booking/durable-operation-runtime";

export async function executeVoiceOperationHoldTick(payload: Record<string, unknown>) {
  const workspaceId = String(payload.workspaceId || "");
  const callId = String(payload.callId || "");
  const operationId = String(payload.operationId || "");
  const tier = Number(payload.tier ?? 1);
  if (!workspaceId || !callId || !operationId) {
    throw new Error("mctb_voice_operation_hold_tick_incomplete");
  }
  const store = getMctbDurableOperationStore();
  const operation = await store.findById(operationId);
  if (!operation || operation.voiceCallId !== callId) {
    return { ok: true, skipped: true, reason: "operation_gone" };
  }
  if (!isOperationInFlight(operation.status)) {
    return { ok: true, skipped: true, reason: "not_in_flight", status: operation.status };
  }
  await speakHoldTierOnCall({
    workspaceId,
    callId,
    operationId,
    tier,
    phrase: holdPhraseForTier(tier),
  });
  return { ok: true, tier, operationId };
}

export async function executeVoiceOperationDeliver(payload: Record<string, unknown>) {
  const workspaceId = String(payload.workspaceId || "");
  const callId = String(payload.callId || "");
  const operationId = String(payload.operationId || "");
  if (!workspaceId || !callId || !operationId) {
    throw new Error("mctb_voice_operation_deliver_incomplete");
  }
  const result = await deliverVoiceOperationIfReady({
    workspaceId,
    callId,
    operationId,
  });
  return { ok: true, delivered: result.delivered, status: result.operation?.status };
}

export async function executeVoiceOperationExpireCheck(payload: Record<string, unknown>) {
  const workspaceId = String(payload.workspaceId || "");
  const callId = String(payload.callId || "");
  const operationId = String(payload.operationId || "");
  if (!workspaceId || !callId || !operationId) {
    throw new Error("mctb_voice_operation_expire_check_incomplete");
  }
  await expireVoiceOperationFallback({ workspaceId, callId, operationId });
  return { ok: true };
}
