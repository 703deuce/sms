import type { VoiceV2FindAvailabilityResult } from "./types";

export type VoiceV2PstnTrace = {
  TELNYX_TOOL_CALLED_AT?: string | null;
  WEBHOOK_RECEIVED_AT: string;
  VALIDATION_COMPLETE_AT?: string | null;
  TOKEN_START_AT?: string | null;
  TOKEN_COMPLETE_AT?: string | null;
  GRAPH_START_AT?: string | null;
  GRAPH_COMPLETE_AT?: string | null;
  AVAILABILITY_COMPUTE_COMPLETE_AT?: string | null;
  HTTP_RESPONSE_AT: string;
  AMY_RESULT_SPOKEN_AT?: string | null;
  TELNYX_TO_WEBHOOK_MS?: number | null;
  VALIDATION_MS: number;
  TOKEN_MS: number;
  GRAPH_MS: number;
  AVAILABILITY_COMPUTE_MS: number;
  WEBHOOK_TOTAL_MS: number;
  RESULT_TO_SPEECH_MS?: number | null;
  CALLER_PERCEIVED_TOTAL_MS?: number | null;
  structured_tool_arguments?: Record<string, unknown>;
  v2_response_summary?: Record<string, unknown>;
};

export function buildVoiceV2PstnTrace(input: {
  webhookReceivedAtMs: number;
  telnyxToolCalledAt?: string | null;
  structuredArgs: Record<string, unknown>;
  result: VoiceV2FindAvailabilityResult;
  httpResponseAtMs: number;
  responsePayload: Record<string, unknown>;
}): VoiceV2PstnTrace {
  const t = input.result.timing;
  const validationCompleteAt = t.INPUT_VALIDATED ?? null;
  const tokenStartAt = t.TOKEN_STARTED ?? null;
  const tokenCompleteAt = t.TOKEN_COMPLETE ?? null;
  const graphStartAt = t.GRAPH_STARTED ?? null;
  const graphCompleteAt = t.GRAPH_COMPLETE ?? null;
  const availCompleteAt = t.AVAILABILITY_COMPUTE_COMPLETE ?? null;

  let telnyxToWebhookMs: number | null = null;
  if (input.telnyxToolCalledAt) {
    const called = Date.parse(input.telnyxToolCalledAt);
    if (!Number.isNaN(called)) {
      telnyxToWebhookMs = Math.max(0, input.webhookReceivedAtMs - called);
    }
  }

  return {
    TELNYX_TOOL_CALLED_AT: input.telnyxToolCalledAt ?? null,
    WEBHOOK_RECEIVED_AT: new Date(input.webhookReceivedAtMs).toISOString(),
    VALIDATION_COMPLETE_AT: validationCompleteAt,
    TOKEN_START_AT: tokenStartAt,
    TOKEN_COMPLETE_AT: tokenCompleteAt,
    GRAPH_START_AT: graphStartAt,
    GRAPH_COMPLETE_AT: graphCompleteAt,
    AVAILABILITY_COMPUTE_COMPLETE_AT: availCompleteAt,
    HTTP_RESPONSE_AT: new Date(input.httpResponseAtMs).toISOString(),
    AMY_RESULT_SPOKEN_AT: null,
    TELNYX_TO_WEBHOOK_MS: telnyxToWebhookMs,
    VALIDATION_MS: input.result.timing_ms.VALIDATION_MS,
    TOKEN_MS: input.result.timing_ms.TOKEN_MS,
    GRAPH_MS: input.result.timing_ms.GRAPH_MS,
    AVAILABILITY_COMPUTE_MS: input.result.timing_ms.AVAILABILITY_COMPUTE_MS,
    WEBHOOK_TOTAL_MS: input.httpResponseAtMs - input.webhookReceivedAtMs,
    RESULT_TO_SPEECH_MS: null,
    CALLER_PERCEIVED_TOTAL_MS: null,
    structured_tool_arguments: input.structuredArgs,
    v2_response_summary: {
      status: input.responsePayload.status,
      ok: input.responsePayload.ok,
      slot_count: Array.isArray(input.responsePayload.slots)
        ? (input.responsePayload.slots as unknown[]).length
        : 0,
      speak: input.responsePayload.speak,
      graph: input.result.status !== "ERROR" ? input.result.graph : undefined,
    },
  };
}
