import type { VoiceAgentConfig } from "@/lib/voice/types";
import { createDefaultQualificationDefinition } from "./default-qualification-definition";
import { normalizeRealtimeNativeVoice } from "./realtime-native-voices";
import type { QualificationDefinition } from "./types";

export const OUTBOUND_LEAD_QUALIFICATION_PROFILE = "outbound_lead_qualification";
export const OUTBOUND_LEAD_QUALIFICATION_REALTIME_PROFILE =
  "outbound_lead_qualification_realtime";

export type OutboundRealtimeReasoningEffort =
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export type VoiceAgentAdvancedConfig = {
  livekitProfile?: string;
  outboundQualification?: QualificationDefinition;
  /** OpenAI Realtime model id — e.g. gpt-realtime-2.1-mini or gpt-realtime-2.1 */
  realtimeModel?: string;
  /** OpenAI Realtime voice — defaults to marin */
  realtimeVoice?: string;
  /** Optional reasoning effort for gpt-realtime-2 family (full model) */
  realtimeReasoningEffort?: OutboundRealtimeReasoningEffort;
  [key: string]: unknown;
};

export function getVoiceAgentAdvanced(config: VoiceAgentConfig): VoiceAgentAdvancedConfig {
  return (config.advanced || {}) as VoiceAgentAdvancedConfig;
}

export function isOutboundLeadQualificationStackProfile(
  config: Pick<VoiceAgentConfig, "advanced">,
): boolean {
  return getVoiceAgentAdvanced(config).livekitProfile === OUTBOUND_LEAD_QUALIFICATION_PROFILE;
}

export function isOutboundLeadQualificationRealtimeProfile(
  config: Pick<VoiceAgentConfig, "advanced">,
): boolean {
  return (
    getVoiceAgentAdvanced(config).livekitProfile ===
    OUTBOUND_LEAD_QUALIFICATION_REALTIME_PROFILE
  );
}

/** Stack or realtime outbound qualification — same workflow, different voice pipeline. */
export function isOutboundLeadQualificationProfile(
  config: Pick<VoiceAgentConfig, "advanced">,
): boolean {
  return (
    isOutboundLeadQualificationStackProfile(config) ||
    isOutboundLeadQualificationRealtimeProfile(config)
  );
}

export function usesOutboundRealtimeVoicePipeline(
  config: Pick<VoiceAgentConfig, "advanced">,
): boolean {
  return isOutboundLeadQualificationRealtimeProfile(config);
}

export type OutboundRealtimePipelineConfig = {
  model: string;
  voice: string;
  reasoning?: { effort: OutboundRealtimeReasoningEffort };
};

export type OutboundRealtimePipelineOverrides = {
  /** Per-call voice — wins over VOICE_REALTIME_VOICE env and agent advanced.realtimeVoice. */
  voice?: string;
  /** Use OpenAI realtime default input transcription (required for nested AgentTask field collection). */
  enableInputAudioTranscription?: boolean;
};

export function resolveOutboundRealtimePipelineConfig(
  config: Pick<VoiceAgentConfig, "advanced">,
  overrides?: OutboundRealtimePipelineOverrides,
): OutboundRealtimePipelineConfig {
  const advanced = getVoiceAgentAdvanced(config);
  const model =
    process.env.VOICE_REALTIME_MODEL?.trim() ||
    String(advanced.realtimeModel || "gpt-realtime-2.1-mini").trim();
  const voiceRaw =
    overrides?.voice?.trim() ||
    process.env.VOICE_REALTIME_VOICE?.trim() ||
    String(advanced.realtimeVoice || "marin").trim();
  const voice = normalizeRealtimeNativeVoice(voiceRaw, "realtimeVoice");

  const envEffort = process.env.VOICE_REALTIME_REASONING_EFFORT?.trim().toLowerCase();
  const configEffort = advanced.realtimeReasoningEffort;
  const effortRaw = envEffort || configEffort;
  const isGptRealtime2Family = model.startsWith("gpt-realtime-2");
  const isMini = model.includes("mini");

  let reasoning: OutboundRealtimePipelineConfig["reasoning"];
  if (isGptRealtime2Family && !isMini) {
    const effort = (effortRaw || "low") as OutboundRealtimeReasoningEffort;
    reasoning = { effort };
  }

  return { model, voice, reasoning };
}

export function getOutboundQualificationFromConfig(
  config: VoiceAgentConfig,
): QualificationDefinition | null {
  const qual = getVoiceAgentAdvanced(config).outboundQualification;
  if (!qual || typeof qual !== "object" || !Array.isArray(qual.fields)) return null;
  return qual;
}

export function withOutboundQualification(
  config: VoiceAgentConfig,
  qualification: QualificationDefinition,
): VoiceAgentConfig {
  return {
    ...config,
    advanced: {
      ...getVoiceAgentAdvanced(config),
      livekitProfile: OUTBOUND_LEAD_QUALIFICATION_PROFILE,
      outboundQualification: qualification,
    },
  };
}

export function ensureOutboundQualificationConfig(
  config: VoiceAgentConfig,
  businessName?: string,
): QualificationDefinition {
  const existing = getOutboundQualificationFromConfig(config);
  if (existing) return existing;
  return createDefaultQualificationDefinition({
    businessName: businessName || "Your business",
  });
}
