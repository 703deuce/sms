import "server-only";

import { getPrisma } from "@/lib/db";
import { releaseAiStartClaim } from "@/lib/voice/ai-start-lock";
import { notePstnLegWizardContext } from "@/lib/voice-v3/telemetry/call-trace";
import { readTelephonyProvisionFromSettings } from "@/lib/voice-v3/receptionist-livekit-policy";

/**
 * Legacy Call Control entry for appointment receptionist — LiveKit SIP is required.
 * Misrouted numbers must fail loudly instead of falling back to Voice V3 Basic.
 */
export async function startAppointmentReceptionistVoiceV3OnCall(input: {
  workspaceId: string;
  callId: string;
  agentId: string;
  telnyxCallControlId: string;
  claimMeta?: Record<string, unknown>;
  path: string;
}): Promise<
  | { started: true; reason: "livekit_sip_required" }
  | { started: false; reason: string }
> {
  notePstnLegWizardContext({
    callControlId: input.telnyxCallControlId,
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
  });

  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: { phoneNumberId: true },
  });
  let ingressHint = "unknown";
  if (agent?.phoneNumberId) {
    const phone = await prisma.phoneNumber.findFirst({
      where: { id: agent.phoneNumberId, workspaceId: input.workspaceId },
      select: { settingsJson: true, e164: true },
    });
    const prov = readTelephonyProvisionFromSettings(phone?.settingsJson);
    ingressHint = `${prov.routingMode || "unset"}:${prov.state || "unset"}`;
  }

  const reason =
    "Appointment receptionist requires LiveKit SIP ingress — this number is not on the LiveKit route. Republish from setup or fix telephony provisioning.";
  console.error("VOICE_V3_RECEPTIONIST_BASIC_PSTN_BLOCKED", {
    callId: input.callId,
    agentId: input.agentId,
    workspaceId: input.workspaceId,
    path: input.path,
    callControlId: input.telnyxCallControlId,
    ingressHint,
  });

  await releaseAiStartClaim(input.callId, reason).catch(() => undefined);
  void prisma.voiceCall
    .update({
      where: { id: input.callId },
      data: {
        metadata: {
          ...(input.claimMeta || {}),
          aiStarted: false,
          voiceTransport: "livekit_sip_required",
          voiceV3WizardBound: true,
          mediaPipeline: { path: input.path, blocked: reason },
        } as object,
      },
    })
    .catch(() => undefined);

  return { started: false, reason };
}
