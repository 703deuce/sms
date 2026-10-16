import type { VoiceAgentConfig } from "@/lib/voice/types";
import { TRANSOVO_LIVEKIT_AGENT_NAME } from "@/lib/telephony/provisioning/config";

/** LiveKit worker that runs GPT-Live Amy + Astra delegation (not legacy template router). */
export const VOICE_V3_LIVEKIT_AGENT_NAME =
  process.env.VOICE_V3_LIVEKIT_AGENT_NAME?.trim() || "transovo-voice-v3";

export function isVoiceV3AppointmentReceptionistConfig(
  config: VoiceAgentConfig | undefined | null,
): boolean {
  if (!config) return false;
  const advanced = (config.advanced || {}) as Record<string, unknown>;
  return advanced.capabilityPack === "appointment_receptionist";
}

/** Which LiveKit agent worker should receive SIP jobs for this published config. */
export function resolveLiveKitInboundDispatchAgentName(
  config: VoiceAgentConfig | undefined | null,
): string {
  if (isVoiceV3AppointmentReceptionistConfig(config)) {
    return VOICE_V3_LIVEKIT_AGENT_NAME;
  }
  return TRANSOVO_LIVEKIT_AGENT_NAME;
}

export type VoiceV3LiveKitJobMetadata = {
  runtime: "voice_v3_gpt_live";
  resolve: "http_backend_on_sip";
  workspaceId: string;
  agentId: string;
  publishedVersionId?: string;
  toE164?: string;
  dispatchSource: string;
};

export function buildVoiceV3LiveKitJobMetadataJson(input: {
  workspaceId: string;
  agentId: string;
  publishedVersionId?: string | null;
  toE164?: string | null;
  dispatchSource?: string;
}): string {
  const payload: VoiceV3LiveKitJobMetadata = {
    runtime: "voice_v3_gpt_live",
    resolve: "http_backend_on_sip",
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    publishedVersionId: input.publishedVersionId || undefined,
    toE164: input.toE164 || undefined,
    dispatchSource: input.dispatchSource || "livekit_job_metadata",
  };
  return JSON.stringify(payload);
}
