import type { VoiceAgentConfig } from "@/lib/voice/types";
import {
  resolveOutboundRealtimePipelineConfig,
  type OutboundRealtimePipelineConfig,
  type OutboundRealtimePipelineOverrides,
} from "@/lib/voice/outbound/agent-config";

export const FRONTDESK_PROFILE = "frontdesk";
export const FRONTDESK_REALTIME_PROFILE = "frontdesk_realtime";

export function livekitProfileFromConfig(
  advanced: Record<string, unknown> | undefined,
): string {
  return String(advanced?.livekitProfile || "").trim().toLowerCase();
}

export function isFrontDeskStackProfile(
  config: Pick<VoiceAgentConfig, "advanced">,
): boolean {
  return livekitProfileFromConfig(config.advanced as Record<string, unknown>) === FRONTDESK_PROFILE;
}

export function isFrontDeskRealtimeProfile(
  config: Pick<VoiceAgentConfig, "advanced">,
): boolean {
  return (
    livekitProfileFromConfig(config.advanced as Record<string, unknown>) ===
    FRONTDESK_REALTIME_PROFILE
  );
}

/** Stack or realtime frontdesk booking — same Calendly tools, different voice pipeline. */
export function isFrontDeskProfile(
  advanced: Record<string, unknown> | undefined,
): boolean {
  const profile = livekitProfileFromConfig(advanced);
  return profile === FRONTDESK_PROFILE || profile === FRONTDESK_REALTIME_PROFILE;
}

export function usesFrontDeskRealtimeVoicePipeline(
  config: Pick<VoiceAgentConfig, "advanced">,
): boolean {
  return isFrontDeskRealtimeProfile(config);
}

export function resolveFrontDeskRealtimePipelineConfig(
  config: Pick<VoiceAgentConfig, "advanced">,
  overrides?: OutboundRealtimePipelineOverrides,
): OutboundRealtimePipelineConfig {
  return resolveOutboundRealtimePipelineConfig(config, overrides);
}
