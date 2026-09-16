import type { VoiceV2TransferAttemptResult } from "../after-hours-handling-types";

export type VoiceV2WarmTransferPhase =
  | "INITIATING"
  | "CONSULT_RINGING"
  | "CONSULT_ANSWERED"
  | "GATHERING"
  | "BRIDGING"
  | "BRIDGED"
  | "FAILED"
  | "CANCELLED";

export type VoiceV2WarmTransferSession = {
  id: string;
  workspaceId: string;
  agentId: string;
  sessionKey: string;
  invocationId: string;
  planId: string;
  transferGeneration: number;
  stepOrder: number;
  stepAttemptId: string;
  destinationId: string;
  destinationE164: string;
  callerCallControlId: string;
  consultationCallControlId?: string;
  fromE164: string;
  briefingText: string;
  timeoutSeconds: number;
  phase: VoiceV2WarmTransferPhase;
  dtmfReplayUsed: boolean;
  bridgeCompleted: boolean;
  lastFailure?: VoiceV2TransferAttemptResult;
  createdAt: string;
  updatedAt: string;
};

export type VoiceV2WarmClientState = {
  kind: "voice_v2_warm_transfer_consult";
  warmSessionId: string;
  workspaceId: string;
  agentId: string;
  sessionKey: string;
  invocationId: string;
  transferGeneration: number;
  stepOrder: number;
  callerControlId: string;
  gatherPhase?: "accept" | "replay";
};
