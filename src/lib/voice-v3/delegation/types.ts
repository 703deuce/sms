export type DelegationPhase =
  | "STARTED"
  | "STREAMING"
  | "AWAITING_TOOL_OUTPUT"
  | "TOOL_OUTPUT_SUBMITTED"
  | "CONTINUING"
  | "COMPLETED"
  | "FAILED";

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
}

export type EmitCallerMeaningFunctionOutput = {
  accepted: boolean;
  reason?: string;
};
