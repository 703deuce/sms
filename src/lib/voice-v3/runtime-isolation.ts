import "server-only";

import type { VoiceAgentConfig } from "@/lib/voice/types";
import { appointmentReceptionistUsesVoiceV3Runtime } from "./config/from-published-agent";

export { appointmentReceptionistUsesVoiceV3Runtime };

export const VOICE_V3_LEGACY_RUNTIME_BLOCKED = "VOICE_V3_ONLY_NO_LEGACY_PIPELINE";

/**
 * Appointment receptionist PSTN must use Voice V3 Basic (SIP → OpenAI Live → voice-v3).
 * Legacy Telnyx Amy + voice_v2_* tools must never run for these agents.
 */
export function blocksLegacyTelnyxVoiceRuntime(config: VoiceAgentConfig): boolean {
  return appointmentReceptionistUsesVoiceV3Runtime(config);
}

export function logLegacyVoiceRuntimeBlocked(input: {
  path: string;
  workspaceId?: string | null;
  agentId?: string | null;
  callId?: string | null;
}): void {
  console.error("VOICE_V3_LEGACY_RUNTIME_BLOCKED", {
    code: VOICE_V3_LEGACY_RUNTIME_BLOCKED,
    path: input.path,
    workspaceId: input.workspaceId ?? null,
    agentId: input.agentId ?? null,
    callId: input.callId ?? null,
    hint: "Use forwardInboundCallToOpenAiLiveSip + /api/openai/live/incoming",
  });
}
