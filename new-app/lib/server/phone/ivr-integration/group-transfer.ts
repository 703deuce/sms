import "server-only";

import { getPrisma } from "@/lib/server/db";
import { phoneServerLog } from "@/lib/server/phone/phone-log";
import {
  inboundCallContext,
  resolveForwardingDestinationRow,
} from "@/lib/server/phone/routing/resolve-destination";
import { runEffectiveForwardingOnSession } from "@/lib/server/phone/routing/forwarding-service";
import type { EffectiveAnswering } from "@/lib/server/phone/routing/resolve-effective-policy";
import { patchRoutingSessionState } from "@/lib/server/phone/routing/session-state";
import type { PhoneIvrHandoffContext } from "./handoff-stages";

export async function loadForwardingGroupEffective(
  workspaceId: string,
  forwardingGroupId: string,
  phoneNumberId: string | null,
): Promise<EffectiveAnswering | null> {
  const group = await getPrisma().forwardingGroup.findFirst({
    where: { id: forwardingGroupId, workspaceId, enabled: true },
    include: {
      members: {
        where: { enabled: true },
        include: { destination: true },
        orderBy: { priority: "asc" },
      },
    },
  });
  if (!group?.members.length) return null;

  const callCtx = await inboundCallContext(workspaceId, phoneNumberId);
  const destinations: Array<{ e164: string; press1: boolean; timeout: number }> = [];
  for (const m of group.members) {
    if (!m.destination?.enabled) continue;
    try {
      const resolved = await resolveForwardingDestinationRow(m.destination, callCtx);
      destinations.push({
        e164: resolved.dialE164,
        press1: resolved.press1,
        timeout: resolved.ringTimeoutSec,
      });
    } catch {
      // skip invalid member
    }
  }
  if (!destinations.length) return null;
  return { kind: "forward_group", strategy: group.strategy, destinations };
}

/**
 * AI-authorized ring group: Phone Call Control executor on the retained inbound leg.
 * Does not use LiveKit TransferSIPParticipant for groups.
 */
export async function executePhoneRingGroupTransfer(input: {
  workspaceId: string;
  humanCallId: string;
  inboundControlId: string;
  phoneNumberId: string | null;
  businessLineE164: string;
  callerE164: string;
  forwardingGroupId: string;
  transferRequestId: string;
  routeId: string;
  routingSessionId?: string | null;
  fallbackAfterExhaust?: boolean;
}): Promise<{ ok: true; routingSessionId: string } | { ok: false; error: string }> {
  const effective = await loadForwardingGroupEffective(
    input.workspaceId,
    input.forwardingGroupId,
    input.phoneNumberId,
  );
  if (!effective) {
    return { ok: false, error: "RING_GROUP_NOT_AVAILABLE" };
  }

  const prisma = getPrisma();
  let sessionId = input.routingSessionId;
  if (!sessionId) {
    const session = await prisma.phoneCallRoutingSession.create({
      data: {
        workspaceId: input.workspaceId,
        phoneNumberId: input.phoneNumberId,
        humanCallId: input.humanCallId,
        inboundCallControlId: input.inboundControlId,
        stage: "ivr_group_transfer",
        stateJson: {
          transferRequestId: input.transferRequestId,
          routeId: input.routeId,
          forwardingGroupId: input.forwardingGroupId,
        },
      },
    });
    sessionId = session.id;
  } else {
    await patchRoutingSessionState(sessionId, {
      transferRequestId: input.transferRequestId,
      routeId: input.routeId,
      forwardingGroupId: input.forwardingGroupId,
      stage: "phone_group_transfer",
    });
  }

  const handoff: PhoneIvrHandoffContext = {
    stage: "PHONE_ROUTING_STARTED",
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    phoneNumberId: input.phoneNumberId,
    inboundCallControlId: input.inboundControlId,
    routingSessionId: sessionId,
    transferRequestId: input.transferRequestId,
    routeId: input.routeId,
  };

  await patchRoutingSessionState(sessionId, {
    integratedHandoff: handoff,
    allowIvrFallbackAfterGroup: input.fallbackAfterExhaust === true,
  });

  await runEffectiveForwardingOnSession({
    sessionId,
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    phoneNumberId: input.phoneNumberId,
    inboundControlId: input.inboundControlId,
    businessLineE164: input.businessLineE164,
    callerE164: input.callerE164,
    effective,
  });

  phoneServerLog("ivr-integration", "phone_ring_group_started", {
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    forwardingGroupId: input.forwardingGroupId,
    routeId: input.routeId,
  });

  return { ok: true, routingSessionId: sessionId };
}
