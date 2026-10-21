import { getPrisma } from "@/lib/server/db";
import { phoneServerLog, maskE164 } from "@/lib/server/phone/phone-log";
import { encodeTelnyxClientState } from "@/lib/server/phone/telnyx-call-actions";
import type { EffectiveAnswering } from "./resolve-effective-policy";
import {
  answerCall,
  dialPstnLeg,
  gatherUsingSpeak,
  requireCallControlConnectionId,
  speakOnCall,
} from "./telnyx-call-control";
import { patchRoutingSessionState } from "./session-state";
import { recordForwardedCallAttempt } from "./usage-accounting";

export async function startForwardingFlow(input: {
  workspaceId: string;
  humanCallId: string;
  phoneNumberId: string | null;
  inboundControlId: string;
  businessLineE164: string;
  callerE164: string;
  effective: EffectiveAnswering;
}) {
  const prisma = getPrisma();
  const session = await prisma.phoneCallRoutingSession.create({
    data: {
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
      humanCallId: input.humanCallId,
      inboundCallControlId: input.inboundControlId,
      stage: "forwarding",
      stateJson: { effective: input.effective },
    },
  });

  await recordForwardedCallAttempt(input.workspaceId);

  const baseState = {
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    routingSessionId: session.id,
    kind: "cf_inbound",
    parentCallControlId: input.inboundControlId,
  };

  await answerCall(input.inboundControlId, baseState);

  if (input.effective.kind === "greeting_then_forward") {
    await speakOnCall(input.inboundControlId, input.effective.greeting, {
      ...baseState,
      parentCallControlId: input.inboundControlId,
      stage: "greeting_done",
      next: "forward",
      destinationE164: input.effective.destinationE164,
    });
    return session;
  }

  if (input.effective.kind === "forward") {
    await dialDestination({
      sessionId: session.id,
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      inboundControlId: input.inboundControlId,
      businessLineE164: input.businessLineE164,
      callerE164: input.callerE164,
      destinationE164: input.effective.destinationE164,
      press1: input.effective.press1,
      screeningText: input.effective.screeningText,
    });
    return session;
  }

  if (input.effective.kind === "staff_then_ivr") {
    await patchRoutingSessionState(session.id, {
      staffThenIvrOverflow: true,
      ringTimeoutSec: input.effective.ringTimeoutSec,
    });
    const list = input.effective.destinations;
    if (input.effective.strategy === "simultaneous") {
      await patchRoutingSessionState(session.id, {
        pendingSimultaneousLegs: list.length,
      });
      for (const dest of list) {
        await dialDestination({
          sessionId: session.id,
          workspaceId: input.workspaceId,
          humanCallId: input.humanCallId,
          inboundControlId: input.inboundControlId,
          businessLineE164: input.businessLineE164,
          callerE164: input.callerE164,
          destinationE164: dest.e164,
          press1: dest.press1,
          simultaneous: true,
        });
      }
    } else {
      const first = list[0];
      if (first) {
        await dialDestination({
          sessionId: session.id,
          workspaceId: input.workspaceId,
          humanCallId: input.humanCallId,
          inboundControlId: input.inboundControlId,
          businessLineE164: input.businessLineE164,
          callerE164: input.callerE164,
          destinationE164: first.e164,
          press1: first.press1,
          sequentialQueue: list.slice(1),
        });
      }
    }
    return session;
  }

  if (input.effective.kind === "forward_group") {
    const list = input.effective.destinations;
    if (input.effective.strategy === "simultaneous") {
      await patchRoutingSessionState(session.id, {
        pendingSimultaneousLegs: list.length,
      });
      for (const dest of list) {
        await dialDestination({
          sessionId: session.id,
          workspaceId: input.workspaceId,
          humanCallId: input.humanCallId,
          inboundControlId: input.inboundControlId,
          businessLineE164: input.businessLineE164,
          callerE164: input.callerE164,
          destinationE164: dest.e164,
          press1: dest.press1,
          simultaneous: true,
        });
      }
    } else {
      const first = list[0];
      if (first) {
        await dialDestination({
          sessionId: session.id,
          workspaceId: input.workspaceId,
          humanCallId: input.humanCallId,
          inboundControlId: input.inboundControlId,
          businessLineE164: input.businessLineE164,
          callerE164: input.callerE164,
          destinationE164: first.e164,
          press1: first.press1,
          sequentialQueue: list.slice(1),
        });
      }
    }
    return session;
  }

  return session;
}

/** Dial forwarding destinations on an existing routing session (AI → Phone group handoff). */
export async function runEffectiveForwardingOnSession(input: {
  sessionId: string;
  workspaceId: string;
  humanCallId: string;
  phoneNumberId: string | null;
  inboundControlId: string;
  businessLineE164: string;
  callerE164: string;
  effective: EffectiveAnswering;
}) {
  if (
    input.effective.kind !== "forward_group" &&
    input.effective.kind !== "staff_then_ivr" &&
    input.effective.kind !== "forward"
  ) {
    throw new Error(`Unsupported effective kind for session forwarding: ${input.effective.kind}`);
  }

  await patchRoutingSessionState(input.sessionId, {
    stage: "forwarding",
    effective: input.effective,
  });

  if (input.effective.kind === "forward") {
    await dialDestination({
      sessionId: input.sessionId,
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      inboundControlId: input.inboundControlId,
      businessLineE164: input.businessLineE164,
      callerE164: input.callerE164,
      destinationE164: input.effective.destinationE164,
      press1: input.effective.press1,
      screeningText: input.effective.screeningText,
    });
    return;
  }

  const list =
    input.effective.kind === "staff_then_ivr"
      ? input.effective.destinations
      : input.effective.destinations;
  const strategy =
    input.effective.kind === "staff_then_ivr"
      ? input.effective.strategy
      : input.effective.strategy;

  if (input.effective.kind === "staff_then_ivr") {
    await patchRoutingSessionState(input.sessionId, {
      staffThenIvrOverflow: true,
      ringTimeoutSec: input.effective.ringTimeoutSec,
    });
  }

  if (strategy === "simultaneous") {
    await patchRoutingSessionState(input.sessionId, {
      pendingSimultaneousLegs: list.length,
      allowIvrFallbackAfterGroup: true,
    });
    for (const dest of list) {
      await dialDestination({
        sessionId: input.sessionId,
        workspaceId: input.workspaceId,
        humanCallId: input.humanCallId,
        inboundControlId: input.inboundControlId,
        businessLineE164: input.businessLineE164,
        callerE164: input.callerE164,
        destinationE164: dest.e164,
        press1: dest.press1,
        simultaneous: true,
      });
    }
    return;
  }

  const first = list[0];
  if (first) {
    await patchRoutingSessionState(input.sessionId, { allowIvrFallbackAfterGroup: true });
    await dialDestination({
      sessionId: input.sessionId,
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      inboundControlId: input.inboundControlId,
      businessLineE164: input.businessLineE164,
      callerE164: input.callerE164,
      destinationE164: first.e164,
      press1: first.press1,
      sequentialQueue: list.slice(1),
    });
  }
}

export async function dialDestination(input: {
  sessionId: string;
  workspaceId: string;
  humanCallId: string;
  inboundControlId: string;
  businessLineE164: string;
  callerE164: string;
  destinationE164: string;
  press1?: boolean;
  screeningText?: string | null;
  simultaneous?: boolean;
  sequentialQueue?: Array<{ e164: string; press1: boolean; timeout: number }>;
}) {
  const connectionId = requireCallControlConnectionId();
  const from =
    input.callerE164 && input.callerE164.length > 3 ? input.callerE164 : input.businessLineE164;
  const clientState = {
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    routingSessionId: input.sessionId,
    kind: "cf_outbound",
    parentCallControlId: input.inboundControlId,
    destinationE164: input.destinationE164,
    press1Required: Boolean(input.press1),
    screeningText: input.screeningText || null,
    businessLineE164: input.businessLineE164,
    callerE164: input.callerE164,
    sequentialQueue: input.sequentialQueue || [],
    simultaneous: Boolean(input.simultaneous),
  };

  const dialed = await dialPstnLeg({
    connectionId,
    toE164: input.destinationE164,
    fromE164: from,
    linkToControlId: input.inboundControlId,
    timeoutSec: 30,
    clientState,
    bridgeOnAnswer: !input.press1,
  });

  const outboundId = dialed.data?.call_control_id?.trim();
  if (!outboundId) throw new Error("Outbound dial missing call_control_id");

  await getPrisma().phoneCallLeg.create({
    data: {
      sessionId: input.sessionId,
      workspaceId: input.workspaceId,
      humanCallId: input.humanCallId,
      direction: "outbound",
      callControlId: outboundId,
      destinationE164: input.destinationE164,
      status: "dialing",
      metadata: { press1: input.press1 },
    },
  });

  phoneServerLog("call-forwarding", "dialed_destination", {
    sessionId: input.sessionId,
    to: maskE164(input.destinationE164),
    press1: input.press1,
  });
}

export async function handleScreeningGather(input: {
  outboundControlId: string;
  digit: string;
  clientState: Record<string, unknown>;
}) {
  const parent = String(input.clientState.parentCallControlId || "");
  if (!parent) return;
  if (input.digit === "1") {
    const { bridgeCalls } = await import("./telnyx-call-control");
    const sessionId = String(input.clientState.routingSessionId || "");
    if (sessionId) {
      const { claimSimultaneousWinner } = await import("./session-state");
      await claimSimultaneousWinner(sessionId, input.outboundControlId);
    }
    await bridgeCalls(parent, input.outboundControlId);
    return;
  }
  const { hangupCall } = await import("./telnyx-call-control");
  await hangupCall(input.outboundControlId);
  if (input.digit === "2") {
    const queue = (input.clientState.sequentialQueue || []) as Array<{
      e164: string;
      press1: boolean;
      timeout: number;
    }>;
    if (queue.length) {
      const next = queue[0];
      await dialDestination({
        sessionId: String(input.clientState.routingSessionId),
        workspaceId: String(input.clientState.workspaceId),
        humanCallId: String(input.clientState.humanCallId),
        inboundControlId: parent,
        businessLineE164: String(input.clientState.businessLineE164 || ""),
        callerE164: String(input.clientState.callerE164 || ""),
        destinationE164: next.e164,
        press1: next.press1,
        sequentialQueue: queue.slice(1),
      });
    }
  }
}
