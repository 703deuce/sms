import "server-only";

import {
  getActiveVoiceOperationForCall,
  holdPhraseForTier,
  isOperationInFlight,
  loadVoiceDurableOpRuntime,
  operationElapsedMs,
  registerVoiceDurableOperationRuntime,
  runtimeHoldTierForElapsed,
  markVoiceOperationHttpAck,
} from "@/lib/voice/ai-booking/durable-operation-runtime";
import { deliverVoiceOperationIfReady } from "@/lib/voice/ai-booking/durable-operation-delivery";
import { startVoiceAiBookingDurableOperation } from "@/lib/mctb/durable-operations/voice-fast-start";
import {
  voiceBookingResponseFromDurableTurn,
  formatVoiceAiBookingToolResponse,
} from "@/lib/voice/ai-booking/tool-result-contract";
import type { VoiceNativeBookingPayload } from "@/lib/voice/ai-booking/voice-native-booking-types";
import type { VoiceBookingIngressMarks } from "@/lib/voice/ai-booking/voice-booking-http-ingress";
import {
  ingressTimingSummary,
  logVoiceBookingIngressTiming,
} from "@/lib/voice/ai-booking/voice-booking-http-ingress";

/**
 * Runtime-owned voice booking tool resolution.
 * The LLM does not poll operation_id — the call session owns pending state.
 */
export async function resolveVoiceBookingToolForCall(input: {
  workspaceId: string;
  agentId?: string | null;
  callId: string;
  utterance?: string;
  confirmBooking?: boolean;
  offeredSlotId?: string | null;
  voiceNative?: VoiceNativeBookingPayload | null;
  externalInvocationId?: string | null;
  actionEpochAtEnqueue?: number | null;
  telnyxConversationId?: string | null;
  toolExecutionId?: string | null;
  ingressMarks?: VoiceBookingIngressMarks;
}): Promise<Record<string, unknown>> {
  const active = await getActiveVoiceOperationForCall(input.callId);

  if (active?.status === "SUCCEEDED") {
    const delivered = await deliverVoiceOperationIfReady({
      workspaceId: input.workspaceId,
      callId: input.callId,
      operationId: active.id,
    });
    if (delivered.delivered && delivered.operation) {
      return voiceBookingResponseFromDurableTurn({
        operationStatus: "SUCCEEDED",
        speak: "",
        operationId: active.id,
        ok: true,
        data: (delivered.operation.resultJson || {}) as Record<string, unknown>,
      });
    }
  }

  if (!input.voiceNative) {
    return formatVoiceAiBookingToolResponse({
      status: "NEEDS_CLARIFICATION",
      speak: "I need a booking action to check the calendar. One moment.",
      ok: false,
      error: "voice_native_structured_action_required",
      data: { needs_structured_action: true },
    });
  }

  if (active && isOperationInFlight(active.status)) {
    const elapsed = await operationElapsedMs(active);
    const tier = runtimeHoldTierForElapsed(elapsed);
    const speak = holdPhraseForTier(tier);
    return formatVoiceAiBookingToolResponse({
      status: "OPERATION_PENDING",
      speak,
      ok: true,
      operationId: active.id,
      data: {
        processing: true,
        runtime_owned: true,
        operation_id: active.id,
        elapsed_ms: elapsed,
        hold_tier: tier,
      },
      agentInstruction:
        "Do not call tools again for polling. The voice runtime will deliver availability when ready. Continue natural conversation if the caller speaks.",
    });
  }

  const started = await startVoiceAiBookingDurableOperation({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
    utterance: input.utterance,
    confirmBooking: input.confirmBooking,
    offeredSlotId: input.offeredSlotId,
    voiceNative: input.voiceNative,
    externalInvocationId: input.externalInvocationId,
    actionEpochAtEnqueue: input.actionEpochAtEnqueue,
    ingressMarks: input.ingressMarks,
  });

  if (started.operationId) {
    void registerVoiceDurableOperationRuntime({
      callId: input.callId,
      operationId: started.operationId,
      workspaceId: input.workspaceId,
      telnyxConversationId: input.telnyxConversationId,
      toolExecutionId: input.toolExecutionId,
    }).catch(() => undefined);
    void markVoiceOperationHttpAck({
      callId: input.callId,
      operationId: started.operationId,
    }).catch(() => undefined);
  }

  const response = voiceBookingResponseFromDurableTurn({
    operationStatus: started.status,
    speak: started.speak,
    operationId: started.operationId,
    ok: started.ok,
    error: started.error,
    data: {
      ...(started.data || {}),
      runtime_owned: true,
    },
  });

  if (input.ingressMarks) {
    input.ingressMarks.httpResponseAt = Date.now();
    logVoiceBookingIngressTiming(input.ingressMarks, {
      operationId: started.operationId,
      callId: input.callId,
    });
    return {
      ...response,
      ingress_timing: ingressTimingSummary(input.ingressMarks),
    };
  }

  return response;
}
