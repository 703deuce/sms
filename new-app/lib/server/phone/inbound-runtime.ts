import { getPrisma } from "@/lib/server/db";
import { isBusinessOpenNow } from "@/lib/server/phone/business-hours";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import { getCallRouting } from "@/lib/server/phone/routing";
import { encodeTelnyxClientState, telnyxCallAction } from "@/lib/server/phone/telnyx-call-actions";
import { resolveExternalForwardTarget } from "@/lib/server/phone/routing-external";
import { leaveVoicemailOnCall } from "@/lib/server/phone/voicemail-runtime";
import { isTelnyxPhoneConfigured } from "@/lib/server/phone/calls-service";
import { maskE164, phoneServerLog } from "@/lib/server/phone/phone-log";

async function resolveContactId(workspaceId: string, phone: string) {
  const prisma = getPrisma();
  const e164 = normalizeE164(phone);
  const row = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId, phone: e164 } },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function resolvePhoneNumberRow(workspaceId: string, e164: string) {
  const prisma = getPrisma();
  return prisma.phoneNumber.findFirst({
    where: { workspaceId, e164: normalizeE164(e164), status: "Active" },
    select: { id: true, settingsJson: true, e164: true },
  });
}

function ringTimeoutMs(policy: { ringTimeout?: number }) {
  const sec = Math.min(Math.max(policy.ringTimeout ?? 25, 10), 120);
  return sec * 1000;
}

export type InboundRouteDecision =
  | { mode: "ring_browser" }
  | { mode: "voicemail" }
  | { mode: "external"; target: string };

export async function decideInboundRoute(
  workspaceId: string,
): Promise<InboundRouteDecision> {
  const routing = await getCallRouting(workspaceId);
  const open = await isBusinessOpenNow(workspaceId);
  const bucket = open ? routing.duringHours : routing.afterHours;

  if (bucket === "voicemail") return { mode: "voicemail" };
  if (bucket === "external") {
    const target = resolveExternalForwardTarget(routing);
    if (target) return { mode: "external", target };
  }
  if (!open && routing.afterHours === "voicemail") return { mode: "voicemail" };
  return { mode: "ring_browser" };
}

export async function processInboundCallInitiated(input: {
  workspaceId: string;
  fromE164: string;
  toE164: string;
  telnyxCallControlId?: string;
}) {
  const prisma = getPrisma();
  const from = normalizeE164(input.fromE164);
  const contactId = await resolveContactId(input.workspaceId, from);
  const pn = await resolvePhoneNumberRow(input.workspaceId, input.toE164);
  const routing = await getCallRouting(input.workspaceId);

  const { resolveEffectiveAnswering } = await import(
    "@/lib/server/phone/routing/resolve-effective-policy"
  );
  const effective = await resolveEffectiveAnswering({
    workspaceId: input.workspaceId,
    phoneNumberId: pn?.id ?? null,
    settingsJson: pn?.settingsJson,
  });

  const route = await decideInboundRoute(input.workspaceId);
  const timeoutAt = new Date(Date.now() + ringTimeoutMs(routing));

  const usesCallForwardingRuntime =
    effective.kind === "forward" ||
    effective.kind === "forward_group" ||
    effective.kind === "staff_then_ivr" ||
    effective.kind === "greeting_then_forward" ||
    effective.kind === "auto_attendant" ||
    effective.kind === "voicemail" ||
    effective.kind === "conversational_ivr";

  const browserRing =
    effective.kind === "browser" && route.mode === "ring_browser";

  phoneServerLog("inbound-runtime", "route_decided", {
    workspaceId: input.workspaceId,
    mode: route.mode,
    effective: effective.kind,
    from: maskE164(input.fromE164),
    to: maskE164(input.toE164),
    hasCallControlId: Boolean(input.telnyxCallControlId),
    ringTimeoutAt: browserRing ? timeoutAt.toISOString() : null,
  });

  const initialStatus =
    effective.kind === "voicemail" || (effective.kind === "browser" && route.mode === "voicemail")
      ? "voicemail"
      : "ringing";

  const call = await prisma.humanCall.create({
    data: {
      workspaceId: input.workspaceId,
      from,
      to: input.toE164,
      direction: "inbound",
      status: initialStatus,
      telnyxCallControlId: input.telnyxCallControlId,
      callerIdNumber: input.toE164,
      phoneNumberId: pn?.id ?? null,
      contactId,
      source: "inbound",
      callbackNeeded: true,
      metadata: {
        ringTimeoutAt: browserRing ? timeoutAt.toISOString() : null,
        inboundRoute: usesCallForwardingRuntime ? effective.kind : route.mode,
        inboundBridgeStatus: browserRing ? "received" : undefined,
        callerCallControlId: input.telnyxCallControlId ?? undefined,
      },
    },
  });

  if (input.telnyxCallControlId && isTelnyxPhoneConfigured()) {
    await telnyxCallAction(input.telnyxCallControlId, "update_client_state", {
      client_state: encodeTelnyxClientState({
        workspaceId: input.workspaceId,
        humanCallId: call.id,
        kind: "human",
      }),
    }).catch(() => undefined);
  }

  if (
    input.telnyxCallControlId &&
    (effective.kind === "voicemail" ||
      (effective.kind === "browser" && route.mode === "voicemail"))
  ) {
    await leaveVoicemailOnCall({
      workspaceId: input.workspaceId,
      humanCallId: call.id,
      telnyxCallControlId: input.telnyxCallControlId,
      phoneNumberId: pn?.id ?? null,
    });
    return call;
  }

  if (input.telnyxCallControlId && effective.kind === "conversational_ivr") {
    const { startConversationalIvrHandoffFromCallControl } = await import(
      "@/lib/server/phone/ivr-integration/livekit-handoff"
    );
    const session = await prisma.phoneCallRoutingSession.create({
      data: {
        workspaceId: input.workspaceId,
        phoneNumberId: pn?.id ?? null,
        humanCallId: call.id,
        inboundCallControlId: input.telnyxCallControlId,
        stage: "conversational_ivr",
        stateJson: { effectiveKind: "conversational_ivr" },
      },
    });
    await startConversationalIvrHandoffFromCallControl({
      workspaceId: input.workspaceId,
      humanCallId: call.id,
      phoneNumberId: pn?.id ?? null,
      inboundControlId: input.telnyxCallControlId,
      businessLineE164: input.toE164,
      callerE164: from,
      routingSessionId: session.id,
      reason: "ivr_first",
    });
    await prisma.humanCall.update({
      where: { id: call.id },
      data: {
        status: "ringing",
        metadata: {
          ...(call.metadata as object),
          inboundRoute: "conversational_ivr",
          routingSessionId: session.id,
        },
      },
    });
    return call;
  }

  if (
    input.telnyxCallControlId &&
    (effective.kind === "forward" ||
      effective.kind === "forward_group" ||
      effective.kind === "staff_then_ivr" ||
      effective.kind === "greeting_then_forward")
  ) {
    const { startForwardingFlow } = await import("@/lib/server/phone/routing/forwarding-service");
    await startForwardingFlow({
      workspaceId: input.workspaceId,
      humanCallId: call.id,
      phoneNumberId: pn?.id ?? null,
      inboundControlId: input.telnyxCallControlId,
      businessLineE164: input.toE164,
      callerE164: from,
      effective,
    });
    await prisma.humanCall.update({
      where: { id: call.id },
      data: {
        status: "ringing",
        metadata: {
          ...(call.metadata as object),
          inboundRoute: "call_forwarding",
          forwardingEffective: effective.kind,
        },
      },
    });
    return call;
  }

  if (input.telnyxCallControlId && effective.kind === "auto_attendant") {
    const { startAutoAttendantFlow } = await import("@/lib/server/phone/routing/menu-executor");
    await startAutoAttendantFlow({
      workspaceId: input.workspaceId,
      humanCallId: call.id,
      phoneNumberId: pn?.id ?? null,
      inboundControlId: input.telnyxCallControlId,
      businessLineE164: input.toE164,
      callerE164: from,
      menuId: effective.menuId,
    });
    await prisma.humanCall.update({
      where: { id: call.id },
      data: {
        status: "ringing",
        metadata: {
          ...(call.metadata as object),
          inboundRoute: "auto_attendant",
          menuId: effective.menuId,
        },
      },
    });
    return call;
  }

  if (route.mode === "external" && input.telnyxCallControlId && effective.kind === "browser") {
    await telnyxCallAction(input.telnyxCallControlId, "answer");
    await telnyxCallAction(input.telnyxCallControlId, "transfer", { to: route.target });
    await prisma.humanCall.update({
      where: { id: call.id },
      data: {
        status: "transferred",
        disposition: `forward:${route.target}`,
        endedAt: new Date(),
      },
    });
    return call;
  }

  if (browserRing && input.telnyxCallControlId) {
    const bridge =
      process.env.PHONE_INBOUND_BRIDGE_WEBRTC?.trim() !== "0";
    if (bridge) {
      const { bridgeInboundCallToWebRtc } = await import(
        "@/lib/server/phone/inbound-webrtc-bridge"
      );
      const ringSec = Math.min(Math.max(routing.ringTimeout ?? 25, 10), 120);
      const result = await bridgeInboundCallToWebRtc({
        telnyxCallControlId: input.telnyxCallControlId,
        businessLineE164: input.toE164,
        callerE164: from,
        workspaceId: input.workspaceId,
        humanCallId: call.id,
        ringTimeoutSec: ringSec,
      }).catch((err) => ({
        ok: false as const,
        reason: err instanceof Error ? err.message : "bridge_failed",
      }));
      phoneServerLog("inbound-runtime", "webrtc_bridge_result", {
        humanCallId: call.id,
        ok: result.ok,
        reason: result.ok ? undefined : result.reason,
      });
      if (!result.ok) {
        await prisma.humanCall.update({
          where: { id: call.id },
          data: {
            metadata: {
              ...(call.metadata as object),
              inboundBridgeError: result.reason,
            },
          },
        });
      }
    } else {
      phoneServerLog("inbound-runtime", "webrtc_bridge_skipped", {
        humanCallId: call.id,
        reason: "PHONE_INBOUND_BRIDGE_WEBRTC=0",
      });
    }
  }

  return call;
}

export async function processDueInboundRingTimeouts(workspaceId: string) {
  const prisma = getPrisma();
  const ringing = await prisma.humanCall.findMany({
    where: {
      workspaceId,
      direction: "inbound",
      status: { in: ["ringing", "initiated", "queued"] },
    },
    take: 25,
    orderBy: { startedAt: "asc" },
  });

  const now = Date.now();
  const routing = await getCallRouting(workspaceId);

  for (const call of ringing) {
    const meta = (call.metadata || {}) as { ringTimeoutAt?: string | null };
    if (!meta.ringTimeoutAt) continue;
    if (new Date(meta.ringTimeoutAt).getTime() > now) continue;
    if (!call.telnyxCallControlId) {
      await prisma.humanCall.update({
        where: { id: call.id },
        data: {
          status: "missed",
          disposition: "missed:no_control_id",
          endedAt: new Date(),
          metadata: { ...meta, ringTimeoutAt: null },
        },
      });
      continue;
    }

    const noAnswer = routing.noAnswer;
    if (noAnswer === "voicemail") {
      await leaveVoicemailOnCall({
        workspaceId,
        humanCallId: call.id,
        telnyxCallControlId: call.telnyxCallControlId,
        phoneNumberId: call.phoneNumberId,
      });
    } else if (noAnswer === "external") {
      const target = resolveExternalForwardTarget(routing);
      if (target) {
        await telnyxCallAction(call.telnyxCallControlId, "answer");
        await telnyxCallAction(call.telnyxCallControlId, "transfer", { to: target });
        await prisma.humanCall.update({
          where: { id: call.id },
          data: {
            status: "transferred",
            disposition: `forward:${target}`,
            endedAt: new Date(),
            metadata: { ...meta, ringTimeoutAt: null },
          },
        });
      } else {
        await telnyxCallAction(call.telnyxCallControlId, "hangup");
        await prisma.humanCall.update({
          where: { id: call.id },
          data: {
            status: "missed",
            disposition: "missed:no_external_target",
            endedAt: new Date(),
            metadata: { ...meta, ringTimeoutAt: null },
          },
        });
      }
    } else {
      await telnyxCallAction(call.telnyxCallControlId, "hangup");
      await prisma.humanCall.update({
        where: { id: call.id },
        data: {
          status: "missed",
          disposition: "missed:ring_timeout",
          endedAt: new Date(),
          metadata: { ...meta, ringTimeoutAt: null },
        },
      });
    }
  }
}

export async function rejectInboundCall(input: {
  workspaceId: string;
  humanCallId: string;
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call?.telnyxCallControlId) throw new Error("Call not found");

  const routing = await getCallRouting(input.workspaceId);
  if (routing.noAnswer === "voicemail") {
    await leaveVoicemailOnCall({
      workspaceId: input.workspaceId,
      humanCallId: call.id,
      telnyxCallControlId: call.telnyxCallControlId,
      phoneNumberId: call.phoneNumberId,
    });
    return call;
  }

  await telnyxCallAction(call.telnyxCallControlId, "hangup");
  return prisma.humanCall.update({
    where: { id: call.id },
    data: {
      status: "missed",
      disposition: "declined",
      endedAt: new Date(),
      handled: false,
    },
  });
}
