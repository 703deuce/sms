import "server-only";

import type { MctbDurableOperationRecord, VoiceOperationVoiceResult } from "./types";
import {
  pickExtendedHoldingPhrase,
  pickInitialHoldingPhrase,
  terminalFailureSpeak,
} from "./holding";

function isTerminalSuccess(status: string): boolean {
  return status === "SUCCEEDED";
}

function isTerminalFailure(status: string): boolean {
  return status === "FAILED_TERMINAL" || status === "EXPIRED";
}

function isInFlight(status: string): boolean {
  return (
    status === "PENDING" ||
    status === "CLAIMED" ||
    status === "PROCESSING" ||
    status === "WAITING_PROVIDER" ||
    status === "FAILED_RETRYABLE"
  );
}

export function resolveVoiceOperationResponse(
  operation: MctbDurableOperationRecord,
  options?: { allowBookingLinkFallback?: boolean },
): VoiceOperationVoiceResult {
  const result = operation.resultJson || {};
  const voicePayload = (result.voice || result) as Record<string, unknown>;

  if (isTerminalSuccess(operation.status)) {
    const speak =
      typeof voicePayload.speak === "string"
        ? voicePayload.speak
        : "I have an update for you.";
    return {
      ok: true,
      status: operation.status,
      operationId: operation.id,
      speak,
      data: {
        ...(typeof voicePayload.data === "object" && voicePayload.data
          ? (voicePayload.data as Record<string, unknown>)
          : {}),
        operation_id: operation.id,
        authoritative: true,
      },
    };
  }

  if (operation.status === "CANCELLED") {
    return {
      ok: false,
      status: operation.status,
      operationId: operation.id,
      speak: "Okay — I cancelled that. How else can I help?",
      error: "OPERATION_CANCELLED",
    };
  }

  if (isTerminalFailure(operation.status)) {
    const speak =
      typeof voicePayload.speak === "string"
        ? voicePayload.speak
        : terminalFailureSpeak(options?.allowBookingLinkFallback);
    return {
      ok: false,
      status: operation.status,
      operationId: operation.id,
      speak,
      error: operation.failureClass || "OPERATION_FAILED",
      data: { operation_id: operation.id, failure_class: operation.failureClass },
    };
  }

  if (isInFlight(operation.status)) {
    const speak =
      operation.attemptCount > 0
        ? pickExtendedHoldingPhrase(operation.id, operation.attemptCount)
        : pickInitialHoldingPhrase(operation.id);
    return {
      ok: true,
      status: operation.status,
      operationId: operation.id,
      speak,
      data: {
        operation_id: operation.id,
        processing: true,
        customerSafeHoldingInstruction: speak,
      },
    };
  }

  return {
    ok: false,
    status: operation.status,
    operationId: operation.id,
    speak: terminalFailureSpeak(options?.allowBookingLinkFallback),
    error: "UNKNOWN_OPERATION_STATE",
  };
}
