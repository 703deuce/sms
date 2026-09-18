import type { LiveSidebandSend } from "../greeting";
import type { VoiceV3LiveResponseCoordinator } from "./live-response-coordinator";

export type SemanticApplicationDisposition =
  | "APPLIED"
  | "EMPTY_NO_CALLER_EVIDENCE"
  | "INVALID_WITH_CALLER_EVIDENCE"
  | "DECODE_FAILED"
  | "DUPLICATE_IGNORED";

export function completeDelegatedFunctionCall(input: {
  coordinator: VoiceV3LiveResponseCoordinator;
  callId: string;
  delegationId: string | null;
  callerTurnId: string | null;
  semanticDisposition: SemanticApplicationDisposition;
  output: Record<string, unknown>;
  startedAtMs?: number;
}): boolean {
  const submitted = input.coordinator.submitDelegatedFunctionCallOutput({
    callId: input.callId,
    delegationId: input.delegationId,
    callerTurnId: input.callerTurnId,
    semanticDisposition: input.semanticDisposition,
    output: input.output,
    startedAtMs: input.startedAtMs,
  });
  return submitted;
}

export type DelegatedFunctionCallSend = LiveSidebandSend;
