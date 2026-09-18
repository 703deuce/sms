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
}): void {
  console.error("VOICE_V3_LEGACY_RUNTIME_BLOCKED", {
    code: VOICE_V3_LEGACY_RUNTIME_BLOCKED,
    path: input.path,
    workspaceId: input.workspaceId ?? null,
    agentId: input.agentId ?? null,
    callId: input.callId ?? null,
    hint: "Appointment receptionist must use startAppointmentReceptionistVoiceV3OnCall only",
  });
}
