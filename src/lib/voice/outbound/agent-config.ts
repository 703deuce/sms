import type { VoiceAgentConfig } from "@/lib/voice/types";
import { createDefaultQualificationDefinition } from "./default-qualification-definition";
import type { QualificationDefinition } from "./types";

export const OUTBOUND_LEAD_QUALIFICATION_PROFILE = "outbound_lead_qualification";

export type VoiceAgentAdvancedConfig = {
  livekitProfile?: string;
  outboundQualification?: QualificationDefinition;
  [key: string]: unknown;
};

export function getVoiceAgentAdvanced(config: VoiceAgentConfig): VoiceAgentAdvancedConfig {
  return (config.advanced || {}) as VoiceAgentAdvancedConfig;
}

export function isOutboundLeadQualificationProfile(
  config: Pick<VoiceAgentConfig, "advanced">,
): boolean {
  return getVoiceAgentAdvanced(config).livekitProfile === OUTBOUND_LEAD_QUALIFICATION_PROFILE;
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
