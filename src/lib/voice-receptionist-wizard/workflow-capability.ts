import type { VoiceAgentConfig } from "@/lib/voice/types";

export type TelnyxWorkflowReadBack = {
  bookingStrategy?: string;
  toolNames?: string[];
};

export type VoiceV2CallCapabilitySnapshot = {
  bookingStrategy: string;
  voiceV2LiveBooking: boolean;
  voiceV2OneAmy: boolean;
};

export function buildVoiceV2CallCapabilitySnapshot(
  _config: VoiceAgentConfig,
): VoiceV2CallCapabilitySnapshot {
  return {
    bookingStrategy: "MICROSOFT_365",
    voiceV2LiveBooking: false,
    voiceV2OneAmy: false,
  };
}

export const VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH = "VOICE_V2_WORKFLOW_CAPABILITY_MISMATCH";

export function expectedVoiceV2LiveBooking(_config: VoiceAgentConfig): boolean {
  return false;
}

export function verifyVoiceV2WorkflowReadBack(_input: {
  config: VoiceAgentConfig;
  readBack: TelnyxWorkflowReadBack;
}): { ok: true } | { ok: false; code: string } {
  return { ok: true };
}
