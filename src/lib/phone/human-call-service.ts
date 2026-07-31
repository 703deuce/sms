import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { resolveCallerIdNumber } from "./settings";

export function isTelnyxPhoneConfigured() {
  return Boolean(getTelnyxApiKey() && process.env.TELNYX_CONNECTION_ID?.trim());
}

function encodeClientState(data: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

export async function dialHumanCall(input: {
  workspaceId: string;
  agentUserId: string;
  to: string;
  from?: string | null;
}) {
  const prisma = getPrisma();
  const to = normalizeE164(input.to);
  const from = await resolveCallerIdNumber(input.workspaceId, input.from);
  if (!from) throw new Error("No active caller ID number configured");

  const call = await prisma.humanCall.create({
    data: {
      workspaceId: input.workspaceId,
      from,
      to,
      direction: "outbound",
      status: "initiated",
      agentUserId: input.agentUserId,
      callerIdNumber: from,
    },
  });

  if (!isTelnyxPhoneConfigured()) {
    const mockId = `mock_${call.id}`;
    await prisma.humanCall.update({
      where: { id: call.id },
      data: { telnyxCallControlId: mockId, status: "ringing" },
    });
    return { call: { ...call, telnyxCallControlId: mockId, status: "ringing" }, mode: "mock" };
  }

  const connectionId = process.env.TELNYX_CONNECTION_ID!.trim();
  const res = await telnyxRequest<{ data: { call_control_id: string } }>("/calls", {
    method: "POST",
    body: {
      connection_id: connectionId,
      from,
      to,
      client_state: encodeClientState({
        workspaceId: input.workspaceId,
        humanCallId: call.id,
        kind: "human",
      }),
    },
  });

  const controlId = res.data?.call_control_id;
  if (!controlId) throw new Error("Telnyx dial returned no call_control_id");

  const updated = await prisma.humanCall.update({
    where: { id: call.id },
    data: { telnyxCallControlId: controlId, status: "ringing" },
  });

  return { call: updated, mode: "telnyx" };
}

export async function handleInboundHumanCall(input: {
  workspaceId: string;
  fromE164: string;
  toE164: string;
  telnyxCallControlId?: string;
}) {
  const prisma = getPrisma();
  const from = normalizeE164(input.fromE164);

  const call = await prisma.humanCall.create({
    data: {
      workspaceId: input.workspaceId,
      from,
      to: input.toE164,
      direction: "inbound",
      status: "ringing",
      telnyxCallControlId: input.telnyxCallControlId,
      callerIdNumber: input.toE164,
    },
  });

  return { callId: call.id, call };
}

async function telnyxAction(controlId: string, action: string, body?: Record<string, unknown>) {
  if (controlId.startsWith("mock_")) return { mode: "mock" };
  await telnyxRequest(`/calls/${controlId}/actions/${action}`, {
    method: "POST",
    body: body ?? {},
  });
  return { mode: "telnyx" };
}

export async function hangupHumanCall(callId: string, workspaceId: string) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call) throw new Error("Call not found");
  if (call.telnyxCallControlId) {
    await telnyxAction(call.telnyxCallControlId, "hangup");
  }
  return prisma.humanCall.update({
    where: { id: callId },
    data: { status: "completed", endedAt: new Date() },
  });
}

export async function muteHumanCall(callId: string, workspaceId: string, muted: boolean) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call) throw new Error("Call not found");
  return prisma.humanCall.update({
    where: { id: callId },
    data: { muted },
  });
}

export async function holdHumanCall(callId: string, workspaceId: string, onHold: boolean) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call) throw new Error("Call not found");
  if (call.telnyxCallControlId) {
    await telnyxAction(call.telnyxCallControlId, onHold ? "hold" : "unhold");
  }
  return prisma.humanCall.update({
    where: { id: callId },
    data: { onHold, status: onHold ? "on_hold" : "in_progress" },
  });
}

export async function transferHumanCall(
  callId: string,
  workspaceId: string,
  toE164: string,
) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call) throw new Error("Call not found");
  const dest = normalizeE164(toE164);
  if (call.telnyxCallControlId) {
    await telnyxAction(call.telnyxCallControlId, "transfer", { to: dest });
  }
  return prisma.humanCall.update({
    where: { id: callId },
    data: { status: "transferred", disposition: `transferred:${dest}` },
  });
}

export async function sendDtmf(callId: string, workspaceId: string, digits: string) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call?.telnyxCallControlId) throw new Error("Call not active");
  if (!call.telnyxCallControlId.startsWith("mock_")) {
    await telnyxAction(call.telnyxCallControlId, "send_dtmf", { digits });
  }
  return call;
}

export async function updateHumanCall(
  callId: string,
  workspaceId: string,
  patch: {
    notes?: string | null;
    disposition?: string | null;
    hangup?: boolean;
    muted?: boolean;
    onHold?: boolean;
    transferTo?: string;
  },
) {
  if (patch.hangup) return hangupHumanCall(callId, workspaceId);
  if (patch.muted !== undefined) return muteHumanCall(callId, workspaceId, patch.muted);
  if (patch.onHold !== undefined) return holdHumanCall(callId, workspaceId, patch.onHold);
  if (patch.transferTo) return transferHumanCall(callId, workspaceId, patch.transferTo);

  const prisma = getPrisma();
  const data: Record<string, unknown> = {};
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.disposition !== undefined) data.disposition = patch.disposition;
  return prisma.humanCall.update({
    where: { id: callId },
    data,
  });
}

export async function processHumanCallWebhookEvent(input: {
  eventType: string;
  humanCallId?: string;
  eventPayload: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  let call = input.humanCallId
    ? await prisma.humanCall.findUnique({ where: { id: input.humanCallId } })
    : null;

  if (!call && input.eventPayload.call_control_id) {
    call = await prisma.humanCall.findFirst({
      where: { telnyxCallControlId: String(input.eventPayload.call_control_id) },
    });
  }
  if (!call) return { ok: false, reason: "human_call_not_found" };

  const statusMap: Record<string, string> = {
    "call.initiated": "initiated",
    "call.ringing": "ringing",
    "call.answered": "in_progress",
    "call.bridged": "in_progress",
    "call.hangup": "completed",
    "call.recording.saved": call.status,
  };

  const nextStatus = statusMap[input.eventType];
  const patch: Record<string, unknown> = {};
  if (nextStatus) patch.status = nextStatus;
  if (nextStatus === "completed") patch.endedAt = new Date();
  if (input.eventType === "call.recording.saved") {
    const urls = input.eventPayload.recording_urls as Record<string, string> | undefined;
    patch.recordingUrl = urls?.mp3 || urls?.wav || null;
  }

  await prisma.humanCall.update({
    where: { id: call.id },
    data: patch,
  });

  return { ok: true, callId: call.id };
}
