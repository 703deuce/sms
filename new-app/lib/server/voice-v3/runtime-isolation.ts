import "server-only";

import type { VoiceAgentConfig } from "@/lib/voice/types";
import {
  appointmentReceptionistUsesVoiceV3Runtime,
  isAppointmentReceptionistAgent,
} from "./config/from-published-agent";

export { appointmentReceptionistUsesVoiceV3Runtime, isAppointmentReceptionistAgent };

export const VOICE_V3_LEGACY_RUNTIME_BLOCKED = "VOICE_V3_ONLY_NO_LEGACY_PIPELINE";

export function blocksLegacyTelnyxVoiceRuntime(config: VoiceAgentConfig): boolean {
  return isAppointmentReceptionistAgent(config);
}

export function logLegacyVoiceRuntimeBlocked(input: {
  path: string;
  workspaceId?: string | null;
  agentId?: string | null;
  callId?: string | null;
  toolType?: string | null;
}): void {
  console.error("VOICE_V3_LEGACY_RUNTIME_BLOCKED", {
    code: VOICE_V3_LEGACY_RUNTIME_BLOCKED,
    path: input.path,
    workspaceId: input.workspaceId ?? null,
    agentId: input.agentId ?? null,
    callId: input.callId ?? null,
    toolType: input.toolType ?? null,
    hint: "Appointment receptionist must use startAppointmentReceptionistVoiceV3OnCall only",
  });
}

/** Telnyx mid-call tool webhooks must never run scheduling for Voice V3 receptionist agents. */
export function receptionistTelnyxToolWebhookBlockedPayload(toolType?: string | null): {
  ok: false;
  error: string;
  error_code: string;
  speak: string;
} {
  const label = toolType?.trim() || "telnyx_tool";
  return {
    ok: false,
    error: `Legacy Telnyx tool "${label}" is disabled for appointment receptionist (Voice V3 only)`,
    error_code: VOICE_V3_LEGACY_RUNTIME_BLOCKED,
    speak:
      "I'm finishing that through our live scheduling system. One moment — or tell me what you'd like to change.",
  };
}

export function shouldBlockTelnyxToolWebhookForReceptionist(
  config: VoiceAgentConfig | null | undefined,
  toolTypeOrId?: string | null,
): boolean {
  if (!blocksLegacyTelnyxVoiceRuntime(config)) return false;
  const key = String(toolTypeOrId || "").trim();
  if (!key) return false;
  return true;
}
