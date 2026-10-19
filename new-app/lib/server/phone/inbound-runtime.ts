import { getPrisma } from "@/lib/server/db";
import { isBusinessOpenNow } from "@/lib/server/phone/business-hours";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import { getCallRouting } from "@/lib/server/phone/routing";
import { encodeTelnyxClientState, telnyxCallAction } from "@/lib/server/phone/telnyx-call-actions";
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

async function resolvePhoneNumberId(workspaceId: string, e164: string) {
  const prisma = getPrisma();
  return prisma.phoneNumber.findFirst({
    where: { workspaceId, e164: normalizeE164(e164), status: "Active" },
    select: { id: true },
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
    const target = process.env.PHONE_INBOUND_EXTERNAL_FORWARD?.trim();
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
  const pn = await resolvePhoneNumberId(input.workspaceId, input.toE164);
  const routing = await getCallRouting(input.workspaceId);
  const route = await decideInboundRoute(input.workspaceId);
  const timeoutAt = new Date(Date.now() + ringTimeoutMs(routing));

  phoneServerLog("inbound-runtime", "route_decided", {
    workspaceId: input.workspaceId,
    mode: route.mode,
    from: maskE164(input.fromE164),
    to: maskE164(input.toE164),
    hasCallControlId: Boolean(input.telnyxCallControlId),
    ringTimeoutAt: route.mode === "ring_browser" ? timeoutAt.toISOString() : null,
  });

  const call = await prisma.humanCall.create({
    data: {
      workspaceId: input.workspaceId,
      from,
      to: input.toE164,
      direction: "inbound",
      status: route.mode === "voicemail" ? "voicemail" : "ringing",
      telnyxCallControlId: input.telnyxCallControlId,
      callerIdNumber: input.toE164,
      phoneNumberId: pn?.id ?? null,
      contactId,
      source: "inbound",
      callbackNeeded: true,
      metadata: {
        ringTimeoutAt: route.mode === "ring_browser" ? timeoutAt.toISOString() : null,
        inboundRoute: route.mode,
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
    });
  }

  if (route.mode === "voicemail" && input.telnyxCallControlId) {
    await leaveVoicemailOnCall({
      workspaceId: input.workspaceId,
      humanCallId: call.id,
      telnyxCallControlId: input.telnyxCallControlId,
      phoneNumberId: pn?.id ?? null,
    });
    return call;
  }

  if (route.mode === "external" && input.telnyxCallControlId) {
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

  if (route.mode === "ring_browser" && input.telnyxCallControlId) {
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
