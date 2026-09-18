import "server-only";

import { getPrisma } from "@/lib/db";
import { forwardInboundCallToOpenAiLiveSip } from "@/lib/voice-v3-basic/telnyx-sip-forward";
import { notePstnLegWizardContext } from "@/lib/voice-v3/telemetry/call-trace";

/**
 * Sole PSTN voice entry for appointment receptionist agents.
 * No Telnyx Amy, no GPT-Live lean bridge, no voice_v2 / voice_ai_booking_turn tools.
 */
export async function startAppointmentReceptionistVoiceV3OnCall(input: {
  workspaceId: string;
  callId: string;
  agentId: string;
  telnyxCallControlId: string;
  claimMeta?: Record<string, unknown>;
  path: string;
}): Promise<{ started: true; reason: "voice_v3_basic_sip_forward" }> {
  notePstnLegWizardContext({
    callControlId: input.telnyxCallControlId,
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
  });
  await forwardInboundCallToOpenAiLiveSip(input.telnyxCallControlId);

  const prisma = getPrisma();
  void prisma.voiceCall
    .update({
      where: { id: input.callId },
      data: {
        metadata: {
          ...(input.claimMeta || {}),
          aiStarted: true,
          aiStartClaimed: true,
          voiceTransport: "voice_v3_basic",
          voiceV3WizardBound: true,
          mediaPipeline: { path: input.path },
        } as object,
      },
    })
    .catch(() => undefined);

  console.log("VOICE_V3_BASIC_INBOUND_SIP_FORWARD", {
    callId: input.callId,
    agentId: input.agentId,
    workspaceId: input.workspaceId,
    path: input.path,
  });

  return { started: true, reason: "voice_v3_basic_sip_forward" };
}
