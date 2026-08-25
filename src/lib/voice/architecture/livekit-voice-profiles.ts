import type { VoiceAgentConfig } from "@/lib/voice/types";
import { isFrontDeskProfile } from "@/lib/voice/frontdesk/agent-config";
import { isRealEstateFrontDeskAgent } from "@/lib/voice/real-estate/config";
import {
  isOutboundLeadQualificationProfile,
  usesOutboundRealtimeVoicePipeline,
} from "@/lib/voice/outbound/agent-config";

/** Agents that must use LiveKit AgentSession — never Telnyx AI Assistant execution. */
export function requiresLiveKitVoiceRuntime(
  config: Pick<VoiceAgentConfig, "advanced"> & { agentType?: string | null },
): boolean {
  const advanced = config.advanced as Record<string, unknown> | undefined;
  if (isFrontDeskProfile(advanced)) return true;
  if (isRealEstateFrontDeskAgent(advanced)) return true;
  if (isOutboundLeadQualificationProfile(config)) return true;
  if (usesOutboundRealtimeVoicePipeline(config)) return true;
  return false;
}

/** Legacy Caller Amy — Telnyx workflow-engine path (test / migration only). */
export function isLegacyCallerAmyAgent(input: {
  agentType?: string | null;
  config?: Pick<VoiceAgentConfig, "advanced">;
}): boolean {
  if (input.config && requiresLiveKitVoiceRuntime(input.config)) return false;
  const type = String(input.agentType || "").trim().toLowerCase();
  return type === "receptionist" || type === "appointment_booking" || type === "caller_amy";
}

export function assertLiveKitOnlyVoiceAgent(input: {
  agentType?: string | null;
  config: Pick<VoiceAgentConfig, "advanced">;
  action: string;
}): void {
  if (requiresLiveKitVoiceRuntime(input.config)) {
    throw new Error(
      `${input.action} is not supported for LiveKit-only voice agents — use LiveKit AgentSession`,
    );
  }
}
