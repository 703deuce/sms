import { appendTraceEvent } from "@/lib/voice/workflow-engine/trace";

export const VOICE_TRACE_KINDS = {
  CALL_STARTED: "CALL_STARTED",
  STATE_ENTERED: "STATE_ENTERED",
  INTENT_CLASSIFIED: "INTENT_CLASSIFIED",
  POLICY_EVALUATED: "POLICY_EVALUATED",
  TOOLS_ENABLED: "TOOLS_ENABLED",
  ACTION_REQUESTED: "ACTION_REQUESTED",
  ACTION_ALLOWED: "ACTION_ALLOWED",
  ACTION_DENIED: "ACTION_DENIED",
  RAG_GATE: "RAG_GATE",
  FALLBACK_TRIGGERED: "FALLBACK_TRIGGERED",
  CALL_ENDED: "CALL_ENDED",
} as const;

export async function emitVoiceTrace(
  callId: string,
  kind: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  await appendTraceEvent(callId, { kind, detail }).catch(() => undefined);
}
