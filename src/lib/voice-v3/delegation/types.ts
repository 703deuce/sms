export type DelegationPhase =
  | "STARTED"
  | "STREAMING"
  | "AWAITING_TOOL_OUTPUT"
  | "TOOL_OUTPUT_SUBMITTED"
  | "CONTINUING"
  | "COMPLETED"
  | "FAILED"
  | "INCOMPLETE";

export interface PendingFunctionCall {
  callId: string;
  name: string;
  argumentsJson: string;
  itemId?: string;
  delegationId: string | null;
  responseId?: string;
  outputSubmitted: boolean;
}

export interface DelegationRuntime {
  delegationId: string;
  responseId?: string;
  phase: DelegationPhase;
  pendingFunctionCalls: Map<string, PendingFunctionCall>;
  submittedFunctionCallIds: Set<string>;
  /** Incremented when a protocol continuation is sent for a completed tool barrier. */
  protocolBarrierGeneration: number;
  lastContinuationEventId: string | null;
}

export type EmitCallerMeaningFunctionOutput = {
  accepted: boolean;
  reason?: string;
};
