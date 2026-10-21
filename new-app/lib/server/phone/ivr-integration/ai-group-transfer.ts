import "server-only";

import { getPrisma } from "@/lib/server/db";
import { phoneServerLog } from "@/lib/server/phone/phone-log";
import { hangupCall } from "@/lib/server/phone/routing/telnyx-call-control";
import { patchRoutingSessionState } from "@/lib/server/phone/routing/session-state";
import { runEffectiveForwardingOnSession } from "@/lib/server/phone/routing/forwarding-service";
import { loadForwardingGroupEffective } from "./group-transfer";
import { findActivePhoneHandoffByLiveSession } from "./resolve-handoff";

export async function executePhoneIvrRingGroupTransferFromLiveSession(input: {
  liveSessionId: string;
  transferRequestId: string;
  routeId: string;
  forwardingGroupId: string;
  workspaceId: string;
}): Promise<
  | { ok: true; status: string; routingSessionId: string }
  | { ok: false; error: string; code?: string }
> {
  const linked = await findActivePhoneHandoffByLiveSession(input.liveSessionId);
  if (!linked) {
    return {
      ok: false,
      code: "NO_CALL_CONTROL_HANDOFF",
      error:
        "This call is not on the integrated Phone Call Control path — ring groups require Telnyx-retained inbound leg (PSTN verification for AI-only ingress).",
    };
  }

  const { routingSessionId, handoff, state } = linked;
  if (handoff.workspaceId !== input.workspaceId) {
    return { ok: false, code: "WORKSPACE_MISMATCH", error: "Invalid workspace for handoff" };
  }

  const exhausted = new Set(handoff.exhaustedGroupIds || []);
  if (exhausted.has(input.forwardingGroupId)) {
    return { ok: false, code: "GROUP_ALREADY_EXHAUSTED", error: "This ring group already failed for this call" };
  }

  const prisma = getPrisma();
  const humanCall = await prisma.humanCall.findUnique({ where: { id: handoff.humanCallId } });
  if (!humanCall?.telnyxCallControlId) {
    return { ok: false, code: "INBOUND_LEG_MISSING", error: "Inbound Call Control leg not found" };
  }

  const inboundControlId =
    state.inboundCallControlId || handoff.inboundCallControlId || humanCall.telnyxCallControlId;

  const sipLeg = state.livekitSipLegControlId;
  if (sipLeg) {
    await hangupCall(sipLeg).catch(() => undefined);
  }

  const effective = await loadForwardingGroupEffective(
    input.workspaceId,
    input.forwardingGroupId,
    handoff.phoneNumberId,
  );
  if (!effective || effective.kind !== "forward_group") {
    return { ok: false, code: "RING_GROUP_NOT_AVAILABLE", error: "Ring group is disabled or empty" };
  }

  await patchRoutingSessionState(routingSessionId, {
    integratedHandoff: {
      ...handoff,
      stage: "PHONE_ROUTING_STARTED",
      transferRequestId: input.transferRequestId,
      routeId: input.routeId,
    },
    transferRequestId: input.transferRequestId,
    routeId: input.routeId,
    forwardingGroupId: input.forwardingGroupId,
    allowIvrFallbackAfterGroup: true,
    stage: "phone_group_transfer",
  });

  const businessLine = humanCall.to;
  const caller = humanCall.from;

  await runEffectiveForwardingOnSession({
    sessionId: routingSessionId,
    workspaceId: input.workspaceId,
    humanCallId: handoff.humanCallId,
    phoneNumberId: handoff.phoneNumberId,
    inboundControlId: inboundControlId,
    businessLineE164: businessLine,
    callerE164: caller,
    effective,
  });

  phoneServerLog("ivr-integration", "ai_ring_group_handoff", {
    workspaceId: input.workspaceId,
    liveSessionId: input.liveSessionId,
    routingSessionId,
    routeId: input.routeId,
    forwardingGroupId: input.forwardingGroupId,
  });

  return { ok: true, status: "phone_group_routing_started", routingSessionId };
}
