import type {
  VoiceV2TransferAttemptResult,
  VoiceV2TransferMode,
} from "../after-hours-handling-types";

export type VoiceV2TransferProviderRequest = {
  workspaceId: string;
  agentId: string;
  callControlId: string;
  destinationE164: string;
  mode: VoiceV2TransferMode;
  briefingText?: string;
  transferGeneration: number;
  stepOrder: number;
  invocationId: string;
};

export type VoiceV2TransferProviderResponse = {
  result: VoiceV2TransferAttemptResult;
  providerReference?: string;
};

export interface VoiceV2TransferProvider {
  initiateTransfer(req: VoiceV2TransferProviderRequest): Promise<VoiceV2TransferProviderResponse>;
  acceptWarmTransfer?(input: {
    callControlId: string;
    transferGeneration: number;
    stepOrder: number;
    dtmf: string;
  }): Promise<VoiceV2TransferAttemptResult>;
}
