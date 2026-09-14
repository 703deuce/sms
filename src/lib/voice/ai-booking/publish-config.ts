import "server-only";

import type { VoiceAgentConfig } from "@/lib/voice/types";
import { isVoiceCanonicalAiBookingActive } from "@/lib/voice/ai-booking/mode";
import {
  CANONICAL_AI_BOOKING_PUBLISHED_TOOL_KEYS,
  isVoiceCanonicalAiBookingPublishMode,
} from "@/lib/voice/workflow-engine/tool-publish";

export { isVoiceCanonicalAiBookingPublishMode };

/**
 * When MCTB AI Booking is ready (AI_BOOK), expose calendar tools on Telnyx and
 * mark config so prompts/workflows stop steering to SMS booking links.
 */
export async function enrichVoiceAgentConfigForCanonicalAiBooking(
  workspaceId: string,
  agentId: string,
  config: VoiceAgentConfig,
): Promise<VoiceAgentConfig> {
  const active = await isVoiceCanonicalAiBookingActive({ workspaceId, agentId });
  if (!active) return config;

  const tools = new Set(config.enabledBuiltinTools || []);
  for (const key of CANONICAL_AI_BOOKING_PUBLISHED_TOOL_KEYS) {
    tools.add(key);
  }

  const advanced = { ...(config.advanced || {}) } as Record<string, unknown>;
  advanced.voiceCanonicalAiBooking = true;

  return {
    ...config,
    enabledBuiltinTools: [...tools],
    advanced,
  };
}
