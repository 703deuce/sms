import { getPrisma } from "@/lib/db";
import { syncVoiceAgentPhoneAssignment } from "@/lib/voice/agent-phone";
import { enableVoiceOnWorkspaceNumber } from "@/lib/phone/telnyx-dual-provision";
import { updateMissedCallTextConfig } from "./config";
import { saveMissedCallTextBack } from "@/lib/solutions/missed-call-text-back/save";

/**
 * Detach a voice agent (e.g. Amy) from a DID and route the number for John MCTB testing.
 * - Clears VoiceAgent.phoneNumberId + join table
 * - Re-provisions Call Control voice (no TeXML assistant)
 * - Points canonical John config at this number
 */
export async function detachVoiceAgentFromNumber(input: {
  workspaceId: string;
  agentId: string;
  phoneNumberId: string;
}) {
  const prisma = getPrisma();
  await syncVoiceAgentPhoneAssignment({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    phoneNumberId: null,
    exclusive: true,
  });
  await prisma.voiceAgent.update({
    where: { id: input.agentId },
    data: { phoneNumberId: null },
  });

  await enableVoiceOnWorkspaceNumber({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
  });

  return { ok: true, agentId: input.agentId, phoneNumberId: input.phoneNumberId };
}

/** Activate John on a workspace DID with immediate MCTB (delay 0). */
export async function activateJohnOnPhoneNumber(input: {
  workspaceId: string;
  phoneNumberId: string;
  delaySeconds?: number;
  messageTemplate?: string;
}) {
  const delaySeconds = input.delaySeconds ?? 0;
  const message =
    input.messageTemplate || "Hi, sorry we missed your call. How can we help?";

  await saveMissedCallTextBack(input.workspaceId, {
    phoneNumberId: input.phoneNumberId,
    initialDelayMinutes: 0,
    initialDelaySeconds: delaySeconds,
    firstMessage: message,
    followUpEnabled: false,
    activate: true,
    name: "John — Missed Call Text Back",
  });

  const configResult = await updateMissedCallTextConfig({
    workspaceId: input.workspaceId,
    patch: {
      enabled: true,
      delay_seconds: delaySeconds,
      initial_message: message,
      phone_number_id: input.phoneNumberId,
    },
    source: "john_activation",
  });

  await enableVoiceOnWorkspaceNumber({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
  });

  return { ok: true, config: configResult.config };
}
