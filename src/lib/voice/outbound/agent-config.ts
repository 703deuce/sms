import type { VoiceAgentConfig } from "@/lib/voice/types";
import type { ReceptionistCompiledSnapshot } from "@/lib/voice/receptionist/types";
import { createDefaultQualificationDefinition } from "./default-qualification-definition";
import { normalizeRealtimeNativeVoice } from "./realtime-native-voices";
import { resolveConfiguredRealtimeVoice } from "@/lib/voice/realtime-voice-picker";
import {
  resolveConfiguredElevenLabsVoice,
} from "@/lib/voice/elevenlabs/receptionist-voice-catalog";
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
  speed?: number;
  reasoning?: { effort: OutboundRealtimeReasoningEffort };
};

export type OutboundRealtimePipelineOverrides = {
  /** Per-call voice — wins over VOICE_REALTIME_VOICE env and agent advanced.realtimeVoice. */
  voice?: string;
  /** Use OpenAI realtime default input transcription (required for nested AgentTask field collection). */
  enableInputAudioTranscription?: boolean;
  /** Inbound front desk SIP — use less eager VAD defaults to reduce false speech interrupts. */
  frontdeskInbound?: boolean;
};

export function isGenericReceptionistRealtimeProfile(
  config: Pick<VoiceAgentConfig, "advanced">,
): boolean {
  const advanced = getVoiceAgentAdvanced(config);
  const compiled = advanced.receptionistCompiled as ReceptionistCompiledSnapshot | undefined;
  return (
    compiled?.livekitProfile === "frontdesk_realtime" ||
    advanced.livekitProfile === "frontdesk_realtime"
  );
}

export function resolveOutboundRealtimePipelineConfig(
  config: Pick<VoiceAgentConfig, "advanced" | "voiceLanguage">,
  overrides?: OutboundRealtimePipelineOverrides,
): OutboundRealtimePipelineConfig {
  const advanced = getVoiceAgentAdvanced(config);
  const compiled = advanced.receptionistCompiled as ReceptionistCompiledSnapshot | undefined;

  if (isGenericReceptionistRealtimeProfile(config) && compiled) {
    const model = String(compiled.realtimeModel || advanced.realtimeModel || "gpt-realtime-2.1-mini").trim();
    const speedRaw = config.voiceLanguage?.speed ?? compiled.voiceSpeed;
    const speed =
      typeof speedRaw === "number" && Number.isFinite(speedRaw)
        ? Math.min(2, Math.max(0.5, speedRaw))
        : undefined;

    const isMini = model.includes("mini");
    let reasoning: OutboundRealtimePipelineConfig["reasoning"];
    if (model.startsWith("gpt-realtime-2") && !isMini) {
      const effortRaw =
        advanced.realtimeReasoningEffort ||
        (process.env.VOICE_REALTIME_REASONING_EFFORT?.trim().toLowerCase() as
          | OutboundRealtimeReasoningEffort
          | undefined);
      reasoning = { effort: effortRaw || "low" };
    }

    const elevenVoice = resolveConfiguredElevenLabsVoice(config) || compiled.voiceId;
    return { model, voice: elevenVoice, speed, reasoning };
  }

  const model =
    process.env.VOICE_REALTIME_MODEL?.trim() ||
    String(advanced.realtimeModel || "gpt-realtime-2.1-mini").trim();
  const fromAgent = resolveConfiguredRealtimeVoice(config);
  const voiceRaw =
    overrides?.voice?.trim() ||
    fromAgent ||
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

  const speedRaw = config.voiceLanguage?.speed;
  const speedCandidate = speedRaw ?? compiled?.voiceSpeed;
  const speed =
    typeof speedCandidate === "number" && Number.isFinite(speedCandidate)
      ? Math.min(2, Math.max(0.5, speedCandidate))
      : undefined;

  return { model, voice, speed, reasoning };
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
