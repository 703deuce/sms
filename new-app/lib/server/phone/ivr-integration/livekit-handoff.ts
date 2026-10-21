import "server-only";

import { getPrisma } from "@/lib/server/db";
import { phoneServerLog } from "@/lib/server/phone/phone-log";
import { dialPstnLeg, requireCallControlConnectionId } from "@/lib/server/phone/routing/telnyx-call-control";
import { resolveLiveKitSipHost } from "@/lib/server/telephony/config";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import { patchRoutingSessionState } from "@/lib/server/phone/routing/session-state";
import type { PhoneIvrHandoffContext } from "./handoff-stages";

function buildLiveKitInboundSipUri(dialedE164: string): string {
  const { host } = resolveLiveKitSipHost();
  if (!host) {
    throw new Error("LiveKit SIP host is not configured for Call Control → IVR handoff");
  }
  const e164 = normalizeE164(dialedE164);
  const user = e164.replace(/\D/g, "");
  return `sip:+${user}@${host}`;
}

export async function resolvePublishedReceptionistAgentId(
  workspaceId: string,
  phoneNumberId: string | null,
): Promise<string | null> {
  if (!phoneNumberId) return null;
  const prisma = getPrisma();
  const link = await prisma.voiceAgentPhoneNumber.findFirst({
    where: { workspaceId, phoneNumberId, inboundEnabled: true },
    orderBy: { isDefault: "desc" },
    select: { agentId: true },
  });
  return link?.agentId ?? null;
}

/**
 * Telnyx Call Control retains the inbound leg; dial SIP to LiveKit and bridge on answer.
 * PSTN verification required for production — mechanism: documented Telnyx dial + bridge.
 */
export async function startConversationalIvrHandoffFromCallControl(input: {
  workspaceId: string;
  humanCallId: string;
  phoneNumberId: string | null;
  inboundControlId: string;
  businessLineE164: string;
  callerE164: string;
  routingSessionId: string;
  reason: string;
}): Promise<PhoneIvrHandoffContext> {
  const agentId = await resolvePublishedReceptionistAgentId(input.workspaceId, input.phoneNumberId);
  if (!agentId) {
    throw new Error("No published Conversational IVR agent is assigned to this business number");
  }

  const sipTo = buildLiveKitInboundSipUri(input.businessLineE164);
  const connectionId = requireCallControlConnectionId();

  const clientState = {
    kind: "cf_ivr_handoff",
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    routingSessionId: input.routingSessionId,
    phoneNumberId: input.phoneNumberId,
    agentId,
    parentCallControlId: input.inboundControlId,
    businessLineE164: input.businessLineE164,
    callerE164: input.callerE164,
    handoffReason: input.reason,
    stage: "AI_ACTIVE",
  };

  const dialed = await dialPstnLeg({
    connectionId,
    toE164: sipTo,
    fromE164: input.businessLineE164,
    linkToControlId: input.inboundControlId,
    timeoutSec: 45,
    clientState,
    bridgeOnAnswer: true,
  });

  const outboundId = dialed.data?.call_control_id;
  if (outboundId) {
    await getPrisma().phoneCallLeg.create({
      data: {
        sessionId: input.routingSessionId,
        workspaceId: input.workspaceId,
        direction: "outbound",
        callControlId: outboundId,
        destinationE164: sipTo,
        status: "dialing",
        metadata: { kind: "livekit_sip_handoff" } as object,
      },
    });
  }

  const handoff: PhoneIvrHandoffContext = {
    stage: "AI_ACTIVE",
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    phoneNumberId: input.phoneNumberId,
    inboundCallControlId: input.inboundControlId,
    routingSessionId: input.routingSessionId,
    agentId,
  };

  await patchRoutingSessionState(input.routingSessionId, {
    integratedHandoff: handoff,
    stage: "conversational_ivr",
    overflowReason: input.reason,
  });

  phoneServerLog("ivr-integration", "livekit_handoff_dialed", {
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    routingSessionId: input.routingSessionId,
    sipTo,
  });

  return handoff;
}
