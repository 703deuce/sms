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
  queueId?: string | null;
  routingNote?: string | null;
}) {
  const prisma = getPrisma();
  const from = normalizeE164(input.fromE164);

  // If a queue is configured for the destination number (or explicitly passed),
  // record which queue is handling the call and its overflow fallback.
  let note = input.routingNote || null;
  let queueId = input.queueId ?? null;
  if (!queueId) {
    try {
      const { resolveQueueForInbound } = await import("./queue-service");
      const queue = await resolveQueueForInbound(input.workspaceId, input.toE164);
      if (queue) {
        queueId = queue.id;
        note = `queue:${queue.name} overflow:${queue.overflowAction}${queue.overflowTarget ? `:${queue.overflowTarget}` : ""}`;
      }
    } catch {
      // best-effort queue resolution
    }
  }

  const call = await prisma.humanCall.create({
    data: {
      workspaceId: input.workspaceId,
      from,
      to: input.toE164,
      direction: "inbound",
      status: "ringing",
      telnyxCallControlId: input.telnyxCallControlId,
      callerIdNumber: input.toE164,
      notes: note,
      queueId: queueId || null,
    },
  });

  // Answer + ring queue members (or leave ringing for softphone poll).
  if (input.telnyxCallControlId && isTelnyxPhoneConfigured()) {
    await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/answer`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);

    if (queueId) {
      const { ringQueueMembers } = await import("./queue-runtime");
      await ringQueueMembers({
        workspaceId: input.workspaceId,
        queueId,
        humanCallId: call.id,
        telnyxCallControlId: input.telnyxCallControlId,
      }).catch((err) => console.warn("[phone] queue ring failed", err));
    }
  }

  return { callId: call.id, call, queueId };
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

export async function answerHumanCall(callId: string, workspaceId: string) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call) throw new Error("Call not found");
  if (call.telnyxCallControlId) {
    await telnyxAction(call.telnyxCallControlId, "answer");
  }
  return prisma.humanCall.update({
    where: { id: callId },
    data: { status: "in_progress" },
  });
}

export async function muteHumanCall(callId: string, workspaceId: string, muted: boolean) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call) throw new Error("Call not found");
  if (call.telnyxCallControlId) {
    // Telnyx Call Control mute/unmute on the live leg.
    await telnyxAction(call.telnyxCallControlId, muted ? "mute" : "unmute").catch(() =>
      telnyxAction(call.telnyxCallControlId!, muted ? "mute_client" : "unmute_client").catch(
        () => undefined,
      ),
    );
  }
  return prisma.humanCall.update({
    where: { id: callId },
    data: { muted },
  });
}

/** Start dual-channel recording on an active softphone call. */
export async function recordHumanCall(callId: string, workspaceId: string, start: boolean) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call?.telnyxCallControlId) throw new Error("Call not active");
  if (!call.telnyxCallControlId.startsWith("mock_")) {
    await telnyxAction(
      call.telnyxCallControlId,
      start ? "record_start" : "record_stop",
      start ? { format: "mp3", channels: "dual" } : {},
    );
  }
  return prisma.humanCall.update({
    where: { id: callId },
    data: {
      notes: start
        ? `${call.notes || ""} [recording:on]`.trim()
        : `${call.notes || ""} [recording:off]`.trim(),
    },
  });
}

/**
 * "Call my phone" bridge: dial the agent's cell first, then dial the destination
 * and bridge the two legs when the agent answers.
 */
export async function dialCallMyPhoneBridge(input: {
  workspaceId: string;
  agentUserId: string;
  agentPhone: string;
  destination: string;
  from?: string | null;
}) {
  const prisma = getPrisma();
  const agentPhone = normalizeE164(input.agentPhone);
  const destination = normalizeE164(input.destination);
  const from = await resolveCallerIdNumber(input.workspaceId, input.from);
  if (!from) throw new Error("No active caller ID number configured");

  const call = await prisma.humanCall.create({
    data: {
      workspaceId: input.workspaceId,
      from,
      to: destination,
      direction: "outbound",
      status: "initiated",
      agentUserId: input.agentUserId,
      callerIdNumber: from,
      notes: `call_my_phone:${agentPhone}`,
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
  // Leg 1: ring the agent's personal phone.
  const agentLeg = await telnyxRequest<{ data: { call_control_id: string } }>("/calls", {
    method: "POST",
    body: {
      connection_id: connectionId,
      from,
      to: agentPhone,
      client_state: encodeClientState({
        workspaceId: input.workspaceId,
        humanCallId: call.id,
        kind: "human_bridge_agent",
        destination,
      }),
    },
  });
  const agentControlId = agentLeg.data?.call_control_id;
  if (!agentControlId) throw new Error("Telnyx dial returned no call_control_id");

  const updated = await prisma.humanCall.update({
    where: { id: call.id },
    data: {
      telnyxCallControlId: agentControlId,
      status: "ringing",
      notes: `call_my_phone:${agentPhone}|dest:${destination}|agent_leg:${agentControlId}`,
    },
  });

  return { call: updated, mode: "telnyx", bridge: true };
}

/** Continue call-my-phone after the agent answers: dial destination and bridge. */
export async function continueCallMyPhoneBridge(input: {
  workspaceId: string;
  humanCallId: string;
  agentCallControlId: string;
  destination: string;
}) {
  if (!isTelnyxPhoneConfigured()) return { mode: "mock" };
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call) throw new Error("Call not found");
  const from = call.callerIdNumber || call.from;
  const connectionId = process.env.TELNYX_CONNECTION_ID!.trim();

  const destLeg = await telnyxRequest<{ data: { call_control_id: string } }>("/calls", {
    method: "POST",
    body: {
      connection_id: connectionId,
      from,
      to: normalizeE164(input.destination),
      client_state: encodeClientState({
        workspaceId: input.workspaceId,
        humanCallId: call.id,
        kind: "human_bridge_dest",
        agentCallControlId: input.agentCallControlId,
      }),
    },
  });
  const destControlId = destLeg.data?.call_control_id;
  if (!destControlId) throw new Error("Destination dial failed");

  // Bridge when destination answers is handled in webhook; try immediate bridge too.
  await telnyxAction(input.agentCallControlId, "bridge", {
    call_control_id: destControlId,
  }).catch(() => undefined);

  await prisma.humanCall.update({
    where: { id: call.id },
    data: {
      status: "in_progress",
      notes: `${call.notes || ""}|dest_leg:${destControlId}`,
    },
  });

  return { mode: "telnyx", destControlId };
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
    answer?: boolean;
    muted?: boolean;
    onHold?: boolean;
    transferTo?: string;
    record?: boolean;
  },
) {
  if (patch.answer) return answerHumanCall(callId, workspaceId);
  if (patch.hangup) return hangupHumanCall(callId, workspaceId);
  if (patch.muted !== undefined) return muteHumanCall(callId, workspaceId, patch.muted);
  if (patch.onHold !== undefined) return holdHumanCall(callId, workspaceId, patch.onHold);
  if (patch.transferTo) return transferHumanCall(callId, workspaceId, patch.transferTo);
  if (patch.record !== undefined) return recordHumanCall(callId, workspaceId, patch.record);

  const prisma = getPrisma();
  const data: Record<string, unknown> = {};
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.disposition !== undefined) data.disposition = patch.disposition;
  const updated = await prisma.humanCall.update({
    where: { id: callId },
    data,
  });

  // A disposition marking the call as missed emits a call.missed automation
  // event so follow-up flows (e.g. missed-call text-back) can fire.
  if (patch.disposition && /missed|no[_ -]?answer|voicemail/i.test(patch.disposition)) {
    const customerPhone = updated.direction === "inbound" ? updated.from : updated.to;
    try {
      const contact = await prisma.contact.findFirst({
        where: { workspaceId, phone: customerPhone },
      });
      if (contact) {
        const { emitAutomationEvent } = await import("@/lib/automations/events");
        await emitAutomationEvent(workspaceId, "call.missed", contact.id, {
          humanCallId: updated.id,
          direction: updated.direction,
          disposition: patch.disposition,
        }).catch(() => undefined);
      }
    } catch (err) {
      console.warn("[human-call] disposition missed-call event failed", callId, err);
    }
  }

  return updated;
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

  // A hangup while still ringing/initiated (never answered) is a missed call.
  const wasAnswered = ["in_progress", "on_hold", "transferred", "completed"].includes(call.status);
  const isMissed = input.eventType === "call.hangup" && !wasAnswered;
  const cause = String(
    input.eventPayload.hangup_cause || input.eventPayload.sip_hangup_cause || "",
  ).toLowerCase();
  if (isMissed) {
    patch.disposition = call.disposition || `missed:${cause || "no_answer"}`;
  }

  await prisma.humanCall.update({
    where: { id: call.id },
    data: patch,
  });

  // Call-my-phone: when the agent answers their cell, dial destination + bridge.
  if (input.eventType === "call.answered") {
    const clientStateRaw = input.eventPayload.client_state;
    let clientState: Record<string, unknown> = {};
    if (typeof clientStateRaw === "string") {
      try {
        clientState = JSON.parse(Buffer.from(clientStateRaw, "base64").toString("utf8"));
      } catch {
        clientState = {};
      }
    }
    if (clientState.kind === "human_bridge_agent" && clientState.destination) {
      await continueCallMyPhoneBridge({
        workspaceId: call.workspaceId,
        humanCallId: call.id,
        agentCallControlId: String(input.eventPayload.call_control_id || call.telnyxCallControlId),
        destination: String(clientState.destination),
      }).catch((err) => console.warn("[human-call] bridge continue failed", err));
    }
    if (
      clientState.kind === "human_bridge_dest" &&
      clientState.agentCallControlId &&
      input.eventPayload.call_control_id
    ) {
      await telnyxAction(String(clientState.agentCallControlId), "bridge", {
        call_control_id: String(input.eventPayload.call_control_id),
      }).catch(() => undefined);
    }
  }

  if (isMissed) {
    // The customer number differs by direction.
    const customerPhone = call.direction === "inbound" ? call.from : call.to;
    try {
      const contact = await prisma.contact.findFirst({
        where: { workspaceId: call.workspaceId, phone: customerPhone },
      });
      if (contact) {
        const { emitAutomationEvent } = await import("@/lib/automations/events");
        await emitAutomationEvent(call.workspaceId, "call.missed", contact.id, {
          humanCallId: call.id,
          direction: call.direction,
          cause,
        }).catch(() => undefined);
      }
    } catch (err) {
      console.warn("[human-call] missed-call event failed", call.id, err);
    }
  }

  return { ok: true, callId: call.id, missed: isMissed };
}
