import "server-only";

import { getPrisma } from "@/lib/server/db";
import { phoneServerLog, maskE164 } from "@/lib/server/phone/phone-log";
import { encodeTelnyxClientState } from "@/lib/server/phone/telnyx-call-actions";
import {
  answerCall,
  bridgeCalls,
  dialSipLeg,
  requireCallControlConnectionId,
} from "@/lib/server/phone/routing/telnyx-call-control";
import { resolveLiveKitSipHost } from "@/lib/server/telephony/config";
import { readLiveKitHandoffRecord } from "@/lib/server/telephony/integrated-phone-ingress";
import { recordAiParticipationStart } from "@/lib/server/phone/orchestration/usage-correlation";

export function buildLiveKitSipDialUri(input: {
  businessLineE164: string;
  sipHost: string;
}): string {
  const digits = input.businessLineE164.replace(/\D/g, "");
  const e164 = input.businessLineE164.startsWith("+") ? `+${digits}` : `+${digits}`;
  const host = input.sipHost.replace(/^sip:/i, "");
  return `sip:${e164}@${host}`;
}

/**
 * Connect caller on Call Control to Conversational IVR via outbound SIP leg to LiveKit.
 * Original inbound call control id remains the correlation anchor for later Phone handoffs.
 */
export async function startConversationalIvrOnCallControlSession(input: {
  workspaceId: string;
  humanCallId: string;
  phoneNumberId: string;
  inboundControlId: string;
  businessLineE164: string;
  callerE164: string;
  agentId?: string | null;
  reason?: "primary" | "no_answer_fallback";
}) {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { settingsJson: true, e164: true },
  });
  if (!phone?.e164) throw new Error("Business line not found");

  const { host, source } = resolveLiveKitSipHost();
  if (!host) {
    throw new Error("LiveKit SIP host is not configured (LIVEKIT_SIP_HOST or LIVEKIT_URL)");
  }

  const handoffMeta = readLiveKitHandoffRecord(phone.settingsJson);
  const sipTo = buildLiveKitSipDialUri({ businessLineE164: phone.e164, sipHost: host });

  const session = await prisma.phoneCallRoutingSession.create({
    data: {
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
      humanCallId: input.humanCallId,
      inboundCallControlId: input.inboundControlId,
      stage: "conversational_ivr",
      stateJson: {
        reason: input.reason || "primary",
        sipHostSource: source,
        agentId: input.agentId || null,
      },
    },
  });

  const baseState = {
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    routingSessionId: session.id,
    kind: "cc_ai_leg",
    parentCallControlId: input.inboundControlId,
    businessLineE164: input.businessLineE164,
    callerE164: input.callerE164,
    dialedE164: phone.e164,
    bootstrapPath: "phone_call_control",
    livekitTrunkId: handoffMeta.trunkId || null,
  };

  await answerCall(input.inboundControlId, baseState);

  const connectionId = requireCallControlConnectionId();
  const dialed = await dialSipLeg({
    connectionId,
    sipUri: sipTo,
    fromE164: input.businessLineE164,
    linkToControlId: input.inboundControlId,
    timeoutSec: 45,
    clientState: baseState,
    bridgeOnAnswer: true,
    sipHeaders: [
      { name: "X-Transovo-Human-Call-Id", value: input.humanCallId },
      { name: "X-Transovo-Bootstrap-Path", value: "phone_call_control" },
      { name: "X-Transovo-Workspace-Id", value: input.workspaceId },
    ],
  });

  const aiLegId = dialed.data?.call_control_id?.trim();
  if (!aiLegId) throw new Error("LiveKit SIP dial missing call_control_id");

  await prisma.phoneCallLeg.create({
    data: {
      sessionId: session.id,
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      direction: "outbound",
      callControlId: aiLegId,
      destinationE164: sipTo,
      status: "dialing",
      metadata: { kind: "livekit_sip_ai", reason: input.reason || "primary" },
    },
  });

  const call = await prisma.humanCall.findUnique({ where: { id: input.humanCallId } });
  const meta = (call?.metadata as Record<string, unknown>) || {};
  await prisma.humanCall.update({
    where: { id: input.humanCallId },
    data: {
      status: "ringing",
      metadata: {
        ...meta,
        orchestration: {
          stage: "ai_active",
          aiLegControlId: aiLegId,
          aiStartedAt: new Date().toISOString(),
          inboundRoute: "conversational_ivr",
          reason: input.reason || "primary",
        },
        callbackNeeded: false,
      },
    },
  });

  await recordAiParticipationStart(input.workspaceId, input.humanCallId);

  phoneServerLog("phone-orchestration", "livekit_sip_dial_started", {
    humanCallId: input.humanCallId,
    to: maskE164(phone.e164),
    sipHost: host,
    reason: input.reason || "primary",
  });

  return { sessionId: session.id, aiLegControlId: aiLegId };
}

export async function bridgeAiLegToCallerIfNeeded(input: {
  parentCallControlId: string;
  aiLegControlId: string;
}) {
  await bridgeCalls(input.parentCallControlId, input.aiLegControlId);
}
