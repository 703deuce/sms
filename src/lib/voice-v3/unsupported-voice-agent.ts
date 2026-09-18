import "server-only";

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxVoiceConfigured } from "@/lib/voice/telnyx/assistant-sync";
import { isAppointmentReceptionistAgent } from "./config/from-published-agent";
import type { VoiceAgentConfig } from "@/lib/voice/types";

export const VOICE_RUNTIME_V3_RECEPTIONIST_ONLY = "voice_runtime_v3_receptionist_only";

const UNSUPPORTED_SPOKEN =
  "This phone line is not configured for our assistant. Please contact the business directly.";

export function isSupportedVoiceRuntimeAgent(config: VoiceAgentConfig | null | undefined): boolean {
  return isAppointmentReceptionistAgent(config);
}

export async function speakUnsupportedVoiceLine(callControlId: string): Promise<void> {
  if (!callControlId || callControlId.startsWith("mock_") || !isTelnyxVoiceConfigured()) return;
  await telnyxRequest(`/calls/${callControlId}/actions/speak`, {
    method: "POST",
    body: { payload: UNSUPPORTED_SPOKEN, voice: "female", language: "en-US" },
  }).catch(() => undefined);
}

/** Non–appointment-receptionist voice agents are not supported (legacy runtimes removed). */
export async function handleUnsupportedVoiceAgentRuntime(input: {
  workspaceId: string;
  callId: string;
  agentId: string;
  telnyxCallControlId?: string | null;
  path: string;
}): Promise<{ started: false; reason: string }> {
  console.error("VOICE_RUNTIME_UNSUPPORTED_AGENT", {
    code: VOICE_RUNTIME_V3_RECEPTIONIST_ONLY,
    path: input.path,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
  });

  if (input.telnyxCallControlId) {
    await speakUnsupportedVoiceLine(input.telnyxCallControlId);
  }

  const prisma = getPrisma();
  await prisma.voiceCall
    .update({
      where: { id: input.callId },
      data: {
        metadata: {
          aiStarted: false,
          voiceRuntimeUnsupported: true,
          voiceRuntimeRequired: "appointment_receptionist_voice_v3",
          unsupportedPath: input.path,
        } as object,
      },
    })
    .catch(() => undefined);

  await prisma.voiceCallEvent
    .create({
      data: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        eventType: "media.ai_start_blocked",
        payload: {
          reason: VOICE_RUNTIME_V3_RECEPTIONIST_ONLY,
          path: input.path,
          agentId: input.agentId,
        } as object,
      },
    })
    .catch(() => undefined);

  return { started: false, reason: VOICE_RUNTIME_V3_RECEPTIONIST_ONLY };
}
