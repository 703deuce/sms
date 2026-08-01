import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { logHumanCallEvent } from "./call-events";
import { markOnCall } from "./presence-service";
import { resolveCallerIdNumber } from "./settings";

export function isTelnyxPhoneConfigured() {
  return Boolean(getTelnyxApiKey() && process.env.TELNYX_CONNECTION_ID?.trim());
}

function encodeClientState(data: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

async function markOnCallSafe(workspaceId: string, userId: string, onCall: boolean) {
  await markOnCall(workspaceId, userId, onCall).catch(() => undefined);
}

async function clearAgentPresence(call: {
  workspaceId: string;
  agentUserId?: string | null;
}) {
  if (!call.agentUserId) return;
  await markOnCallSafe(call.workspaceId, call.agentUserId, false);
}

/** Hang up a Call Control leg; ignore mock ids and network errors. */
async function hangupControlLeg(controlId: string | null | undefined) {
  if (!controlId || controlId.startsWith("mock_")) return;
  await telnyxAction(controlId, "hangup").catch(() => undefined);
}

async function assertNotDnd(workspaceId: string, agentUserId: string) {
  const prisma = getPrisma();
  const { getSoftphonePermissions } = await import("./softphone-permissions");
  const { settings: userSettings } = await getSoftphonePermissions(workspaceId, agentUserId);
  if (userSettings?.dndEnabled) {
    throw new Error("Cannot place calls while Do Not Disturb is enabled");
  }
  const presence = await prisma.softphonePresence.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: agentUserId } },
  });
  if (presence?.status === "dnd") {
    throw new Error("Cannot place calls while presence is Do Not Disturb");
  }
}

export async function dialHumanCall(input: {
  workspaceId: string;
  agentUserId: string;
  to: string;
  from?: string | null;
  anonymous?: boolean;
}) {
  const prisma = getPrisma();
  const to = normalizeE164(input.to);
  const from = await resolveCallerIdNumber(input.workspaceId, input.from, input.agentUserId);
  if (!from) throw new Error("No active caller ID number configured");

  const { getSoftphonePermissions, requireSoftphonePermission } = await import(
    "./softphone-permissions"
  );
  await requireSoftphonePermission(input.workspaceId, input.agentUserId, "place_call");
  if (input.anonymous) {
    await requireSoftphonePermission(input.workspaceId, input.agentUserId, "anonymous_dial");
  }

  const { settings: userSettings, allowed } = await getSoftphonePermissions(
    input.workspaceId,
    input.agentUserId,
  );
  if (userSettings?.dndEnabled) {
    throw new Error("Cannot place calls while Do Not Disturb is enabled");
  }
  const presence = await prisma.softphonePresence.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: input.workspaceId,
        userId: input.agentUserId,
      },
    },
  });
  if (presence?.status === "dnd") {
    throw new Error("Cannot place calls while presence is Do Not Disturb");
  }
  if (!to.startsWith("+1") && !allowed.has("international")) {
    throw new Error("International calling is disabled for this user");
  }

  let contactId: string | null = null;
  try {
    const { resolveContactIdForPhone } = await import("@/lib/contacts/activity-timeline");
    contactId = await resolveContactIdForPhone(input.workspaceId, to);
  } catch {
    // best-effort contact attach
  }

  const call = await prisma.humanCall.create({
    data: {
      workspaceId: input.workspaceId,
      from,
      to,
      direction: "outbound",
      status: "initiated",
      agentUserId: input.agentUserId,
      callerIdNumber: from,
      mediaMode: "call_control",
      notes: input.anonymous ? "[anonymous_dial]" : null,
      contactId,
    },
  });

  try {
    if (!isTelnyxPhoneConfigured()) {
      const mockId = `mock_${call.id}`;
      const updated = await prisma.humanCall.update({
        where: { id: call.id },
        data: { telnyxCallControlId: mockId, status: "ringing" },
      });
      await markOnCallSafe(input.workspaceId, input.agentUserId, true);
      return { call: updated, mode: "mock" };
    }

    const connectionId = process.env.TELNYX_CONNECTION_ID!.trim();
    const dialBody: Record<string, unknown> = {
      connection_id: connectionId,
      from,
      to,
      client_state: encodeClientState({
        workspaceId: input.workspaceId,
        humanCallId: call.id,
        kind: "human",
        anonymous: Boolean(input.anonymous),
      }),
    };
    if (input.anonymous) {
      // Best-effort privacy presentation — Telnyx honors privacy when supported on the connection.
      dialBody.privacy = ["number"];
      dialBody.from_display_name = "Anonymous";
    }
    const res = await telnyxRequest<{ data: { call_control_id: string } }>("/calls", {
      method: "POST",
      body: dialBody,
    });

    const controlId = res.data?.call_control_id;
    if (!controlId) throw new Error("Telnyx dial returned no call_control_id");

    const updated = await prisma.humanCall.update({
      where: { id: call.id },
      data: { telnyxCallControlId: controlId, status: "ringing" },
    });

    await markOnCallSafe(input.workspaceId, input.agentUserId, true);
    await logHumanCallEvent(input.workspaceId, call.id, "outbound.dialed", {
      to,
      from,
      controlId,
      anonymous: Boolean(input.anonymous),
    });

    return { call: updated, mode: "telnyx" };
  } catch (err) {
    await prisma.humanCall
      .update({
        where: { id: call.id },
        data: { status: "failed", endedAt: new Date(), disposition: "dial_failed" },
      })
      .catch(() => undefined);
    throw err;
  }
}

/**
 * Create a HumanCall row for a WebRTC softphone dial (browser media path).
 * Does not place a Call Control dial — the TelnyxRTC client owns media.
 * Call-control id is linked later via linkHumanCallControlId when the SDK exposes it.
 */
export async function createWebRtcHumanCall(input: {
  workspaceId: string;
  agentUserId: string;
  to: string;
  from?: string | null;
  anonymous?: boolean;
  webrtcCallId?: string | null;
  direction?: "outbound" | "inbound";
}) {
  const prisma = getPrisma();
  const to = normalizeE164(input.to);
  const from = await resolveCallerIdNumber(
    input.workspaceId,
    input.from,
    input.agentUserId,
  );
  if (!from) throw new Error("No active caller ID number configured");

  const { getSoftphonePermissions, requireSoftphonePermission } = await import(
    "./softphone-permissions"
  );
  await requireSoftphonePermission(input.workspaceId, input.agentUserId, "place_call");
  if (input.anonymous) {
    await requireSoftphonePermission(input.workspaceId, input.agentUserId, "anonymous_dial");
  }
  const { settings: userSettings, allowed } = await getSoftphonePermissions(
    input.workspaceId,
    input.agentUserId,
  );
  if (userSettings?.dndEnabled && input.direction !== "inbound") {
    throw new Error("Cannot place calls while Do Not Disturb is enabled");
  }
  if (input.direction !== "inbound") {
    const presence = await prisma.softphonePresence.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: input.workspaceId,
          userId: input.agentUserId,
        },
      },
    });
    if (presence?.status === "dnd") {
      throw new Error("Cannot place calls while presence is Do Not Disturb");
    }
  }
  if (!to.startsWith("+1") && !allowed.has("international") && input.direction !== "inbound") {
    throw new Error("International calling is disabled for this user");
  }

  let contactId: string | null = null;
  try {
    const { resolveContactIdForPhone } = await import("@/lib/contacts/activity-timeline");
    // For both outbound dial and inbound register, `to` is the remote/customer party.
    contactId = await resolveContactIdForPhone(input.workspaceId, to);
  } catch {
    // best-effort
  }

  const webrtcNote = input.webrtcCallId ? `webrtc:${input.webrtcCallId}` : "webrtc";
  const direction = input.direction || "outbound";
  // Outbound: from=callerId, to=destination. Inbound answer register: input.to=customer.
  const callFrom = direction === "inbound" ? to : from;
  const callTo = direction === "inbound" ? from : to;

  // Dedupe inbound WebRTC answer against an existing ringing/queued webhook row.
  if (direction === "inbound") {
    const digits = to.replace(/\D/g, "").slice(-10);
    const existing = await prisma.humanCall.findFirst({
      where: {
        workspaceId: input.workspaceId,
        direction: "inbound",
        status: { in: ["ringing", "queued", "on_hold"] },
        OR: [
          { from: to },
          ...(digits ? [{ from: { endsWith: digits } }] : []),
          ...(input.webrtcCallId
            ? [{ notes: { contains: `webrtc:${input.webrtcCallId}` } }]
            : []),
        ],
      },
      orderBy: { startedAt: "desc" },
    });
    if (existing) {
      const notes = `${(existing.notes || "").replace(/webrtc:[^\s]+/g, "").trim()} ${webrtcNote}`.trim();
      const updated = await prisma.humanCall.update({
        where: { id: existing.id },
        data: {
          status: "in_progress",
          agentUserId: input.agentUserId,
          mediaMode: "webrtc",
          answeredAt: existing.answeredAt || new Date(),
          contactId: existing.contactId || contactId,
          notes,
        },
      });
      await markOnCallSafe(input.workspaceId, input.agentUserId, true);
      await logHumanCallEvent(input.workspaceId, updated.id, "webrtc.call_linked", {
        webrtcCallId: input.webrtcCallId || null,
        direction: "inbound",
      });
      return { call: updated, mode: "webrtc" as const };
    }
  }

  const call = await prisma.humanCall.create({
    data: {
      workspaceId: input.workspaceId,
      from: callFrom,
      to: callTo,
      direction,
      status: direction === "inbound" ? "in_progress" : "ringing",
      agentUserId: input.agentUserId,
      callerIdNumber: from,
      mediaMode: "webrtc",
      contactId,
      answeredAt: direction === "inbound" ? new Date() : undefined,
      notes: [input.anonymous ? "[anonymous_dial]" : null, webrtcNote].filter(Boolean).join(" "),
    },
  });

  await markOnCallSafe(input.workspaceId, input.agentUserId, true);
  await logHumanCallEvent(input.workspaceId, call.id, "webrtc.call_created", {
    webrtcCallId: input.webrtcCallId || null,
    direction: input.direction || "outbound",
    to,
    from,
  });

  return { call, mode: "webrtc" as const };
}

/** Attach Telnyx Call Control id to a WebRTC-originated HumanCall so park/transfer work. */
export async function linkHumanCallControlId(
  callId: string,
  workspaceId: string,
  telnyxCallControlId: string,
  webrtcCallId?: string | null,
) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call) throw new Error("Call not found");
  const notes = webrtcCallId
    ? `${(call.notes || "").replace(/webrtc:[^\s]+/, "").trim()} webrtc:${webrtcCallId}`.trim()
    : call.notes;
  const updated = await prisma.humanCall.update({
    where: { id: callId },
    data: {
      telnyxCallControlId,
      mediaMode: call.mediaMode || "webrtc",
      notes,
    },
  });
  await logHumanCallEvent(workspaceId, callId, "webrtc.control_linked", {
    telnyxCallControlId,
    webrtcCallId: webrtcCallId || null,
  });
  return updated;
}

export async function handleInboundHumanCall(input: {
  workspaceId: string;
  fromE164: string;
  toE164: string;
  telnyxCallControlId?: string;
  queueId?: string | null;
  routingNote?: string | null;
  /** When false, leave the PSTN leg ringing for softphone pick-up (default: answer only for queues). */
  autoAnswer?: boolean;
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

  let contactId: string | null = null;
  try {
    const { resolveContactIdForPhone } = await import("@/lib/contacts/activity-timeline");
    contactId = await resolveContactIdForPhone(input.workspaceId, from);
  } catch {
    // best-effort contact attach
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
      contactId,
    },
  });

  // Attach client_state so later webhooks resolve this HumanCall even before DB race windows close.
  if (input.telnyxCallControlId && isTelnyxPhoneConfigured()) {
    await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/update_client_state`, {
      method: "POST",
      body: {
        client_state: encodeClientState({
          workspaceId: input.workspaceId,
          humanCallId: call.id,
          kind: "human",
          queueId: queueId || null,
        }),
      },
    }).catch(() => undefined);
  }

  // Queues need an answered+held leg for hold music / member ring.
  // Plain softphone inbound stays ringing so the UI poll / WebRTC invite can pick it up.
  const shouldAnswer =
    input.autoAnswer !== undefined ? input.autoAnswer : Boolean(queueId);

  if (input.telnyxCallControlId && isTelnyxPhoneConfigured() && shouldAnswer) {
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

  // Multi-device incoming-call push (best-effort; softphone also polls).
  // Queue rings notify from ringQueueMembers (current hunt member only).
  if (!queueId) {
    try {
      const { notifyUsersForInboundCall } = await import("./incoming-notify");
      const targetedUser =
        String(note || "").match(/forward_user:([^\s]+)/)?.[1] ||
        String(note || "").match(/screening:([^\s]+)/)?.[1] ||
        null;
      await notifyUsersForInboundCall({
        workspaceId: input.workspaceId,
        humanCallId: call.id,
        fromE164: from,
        toE164: input.toE164,
        userIds: targetedUser ? [targetedUser] : undefined,
      });
    } catch (err) {
      console.warn("[phone] incoming push notify failed", err);
    }
  }

  // Unanswered timeout for non-queue softphone rings (forwarding "unanswered" rules).
  if (!queueId && input.telnyxCallControlId) {
    try {
      const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
      await enqueueJob({
        jobType: "phone_softphone_ring_timeout",
        queueName: "voice-calls",
        workspaceId: input.workspaceId,
        payload: {
          workspaceId: input.workspaceId,
          humanCallId: call.id,
          telnyxCallControlId: input.telnyxCallControlId,
          toE164: input.toE164,
        },
        idempotencyKey: `softphone-ring-timeout-${call.id}`,
        runAfter: new Date(Date.now() + 30_000),
      });
    } catch (err) {
      console.warn("[phone] softphone ring timeout enqueue failed", err);
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

export async function hangupHumanCall(
  callId: string,
  workspaceId: string,
  disposition?: string | null,
) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call) throw new Error("Call not found");
  await hangupControlLeg(call.telnyxCallControlId);
  // Also tear down consult / flip / bridge destination legs.
  if (call.telnyxCallLegId && call.telnyxCallLegId !== call.telnyxCallControlId) {
    await hangupControlLeg(call.telnyxCallLegId);
  }
  await logHumanCallEvent(workspaceId, callId, "call.hangup_requested", {
    controlId: call.telnyxCallControlId,
    secondaryControlId: call.telnyxCallLegId,
    disposition: disposition || null,
  });
  const nextDisposition = disposition || call.disposition || null;
  const updated = await prisma.humanCall.update({
    where: { id: callId },
    data: {
      status: "completed",
      endedAt: new Date(),
      telnyxCallLegId: null,
      ...(nextDisposition ? { disposition: nextDisposition } : {}),
    },
  });

  await clearAgentPresence(updated);

  if (nextDisposition && /missed|no[_ -]?answer|voicemail|declined/i.test(nextDisposition)) {
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
          disposition: nextDisposition,
        }).catch(() => undefined);
      }
    } catch (err) {
      console.warn("[human-call] hangup missed-call event failed", callId, err);
    }
  }

  return updated;
}

export async function answerHumanCall(
  callId: string,
  workspaceId: string,
  agentUserId?: string | null,
) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call) throw new Error("Call not found");
  if (call.telnyxCallControlId) {
    await telnyxAction(call.telnyxCallControlId, "answer");
    // Screening holds the caller until an agent accepts from softphone/UI.
    if (call.onHold || (call.notes || "").includes("screening:")) {
      await telnyxAction(call.telnyxCallControlId, "unhold").catch(() => undefined);
    }
  }
  if (agentUserId) {
    await markOnCallSafe(workspaceId, agentUserId, true);
  }
  const answeredAt = call.answeredAt || new Date();
  await logHumanCallEvent(workspaceId, callId, "call.answered", {
    controlId: call.telnyxCallControlId,
    answerToDbMs: Date.now() - new Date(call.startedAt).getTime(),
    screening: (call.notes || "").includes("screening:"),
    agentUserId: agentUserId || null,
  });
  return prisma.humanCall.update({
    where: { id: callId },
    data: {
      status: "in_progress",
      onHold: false,
      answeredAt,
      ...(agentUserId ? { agentUserId } : {}),
    },
  });
}

export async function muteHumanCall(
  callId: string,
  workspaceId: string,
  muted: boolean,
  agentUserId?: string | null,
) {
  const prisma = getPrisma();
  let call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call) throw new Error("Call not found");

  // For Call Control / call-my-phone, promote into a conference so mute can target the agent leg.
  if (
    muted &&
    !call.conferenceId &&
    call.mediaMode !== "webrtc" &&
    call.telnyxCallControlId &&
    !call.telnyxCallControlId.startsWith("mock_") &&
    isTelnyxPhoneConfigured()
  ) {
    const { createConferenceFromCall } = await import("./conference-service");
    await createConferenceFromCall({
      workspaceId,
      hostUserId: agentUserId || call.agentUserId || "system",
      humanCallId: call.id,
      name: `Mute ${call.to}`,
    }).catch((err) => console.warn("[human-call] mute conference create failed", err));
    call = (await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } })) || call;
  }

  const muteControlId =
    call.mediaMode === "call_my_phone" && call.telnyxCallLegId
      ? call.telnyxCallLegId
      : call.telnyxCallControlId;

  if (call.conferenceId && muteControlId && !muteControlId.startsWith("mock_")) {
    const conf = await prisma.conferenceCall.findUnique({ where: { id: call.conferenceId } });
    if (conf?.telnyxConferenceId && !conf.telnyxConferenceId.startsWith("mock_")) {
      await telnyxRequest(
        `/conferences/${conf.telnyxConferenceId}/actions/${muted ? "mute" : "unmute"}`,
        {
          method: "POST",
          body: { call_control_ids: [muteControlId] },
        },
      ).catch((err) => console.warn("[human-call] conference mute failed", err));
    }
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
      recordingStartedAt: start ? new Date() : call.recordingStartedAt,
      notes: start
        ? `${call.notes || ""} [recording:on]`.trim()
        : `${call.notes || ""} [recording:off]`.trim(),
    },
  });
}

/** Start live transcription on a softphone call and persist later via webhook. */
export async function startHumanCallTranscription(callId: string, workspaceId: string) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call?.telnyxCallControlId) throw new Error("Call not active");
  if (!call.telnyxCallControlId.startsWith("mock_")) {
    const { startCallTranscription } = await import("@/lib/voice/telnyx/assistant-sync");
    await startCallTranscription(call.telnyxCallControlId);
  }
  return prisma.humanCall.update({
    where: { id: callId },
    data: {
      notes: `${call.notes || ""} [transcription:on]`.trim(),
    },
  });
}

/** Flip an active call to another device (cell / secondary endpoint). */
export async function flipHumanCall(
  callId: string,
  workspaceId: string,
  deviceNumber: string,
) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call?.telnyxCallControlId) throw new Error("Call not active for flip");
  const dest = normalizeE164(deviceNumber);
  const controlId = call.telnyxCallControlId;

  if (!controlId.startsWith("mock_")) {
    await telnyxAction(controlId, "hold").catch(() => undefined);
    const connectionId = process.env.TELNYX_CONNECTION_ID!.trim();
    const flipLeg = await telnyxRequest<{ data: { call_control_id: string } }>("/calls", {
      method: "POST",
      body: {
        connection_id: connectionId,
        from: call.callerIdNumber || call.from,
        to: dest,
        client_state: encodeClientState({
          workspaceId,
          humanCallId: call.id,
          kind: "call_flip",
          parentCallControlId: controlId,
        }),
      },
    });
    const flipControlId = flipLeg.data?.call_control_id;
    if (!flipControlId) throw new Error("Call flip dial failed");
    return prisma.humanCall.update({
      where: { id: callId },
      data: {
        onHold: true,
        status: "on_hold",
        telnyxCallLegId: flipControlId,
        notes: `${call.notes || ""}\n[call_flip:${dest}]`.trim(),
        mediaMode: "call_my_phone",
      },
    });
  }

  return prisma.humanCall.update({
    where: { id: callId },
    data: {
      onHold: true,
      status: "on_hold",
      telnyxCallLegId: `mock_flip_${call.id}`,
      notes: `${call.notes || ""}\n[call_flip:${dest}]`.trim(),
      mediaMode: "call_my_phone",
    },
  });
}

/** Merge two active softphone lines into a conference. */
export async function mergeHumanCalls(
  workspaceId: string,
  hostUserId: string,
  primaryCallId: string,
  secondaryCallId: string,
) {
  const prisma = getPrisma();
  const primary = await prisma.humanCall.findFirst({
    where: { id: primaryCallId, workspaceId },
  });
  const secondary = await prisma.humanCall.findFirst({
    where: { id: secondaryCallId, workspaceId },
  });
  if (!primary?.telnyxCallControlId || !secondary?.telnyxCallControlId) {
    throw new Error("Both calls must be active to merge");
  }

  const { createConferenceFromCall } = await import("./conference-service");
  const conference = await createConferenceFromCall({
    workspaceId,
    hostUserId,
    humanCallId: primary.id,
    name: `Merge ${primary.to}`,
  });

  if (
    isTelnyxPhoneConfigured() &&
    conference.telnyxConferenceId &&
    !secondary.telnyxCallControlId.startsWith("mock_")
  ) {
    await telnyxAction(secondary.telnyxCallControlId, "unhold").catch(() => undefined);
    await telnyxRequest(`/conferences/${conference.telnyxConferenceId}/actions/join`, {
      method: "POST",
      body: { call_control_id: secondary.telnyxCallControlId },
    }).catch(() => undefined);
  }

  await prisma.conferenceParticipant.create({
    data: {
      workspaceId,
      conferenceId: conference.id,
      humanCallId: secondary.id,
      telnyxCallControlId: secondary.telnyxCallControlId,
      displayName: secondary.to,
      role: "participant",
      status: "joined",
    },
  });
  await prisma.humanCall.update({
    where: { id: secondary.id },
    data: { conferenceId: conference.id, onHold: false, status: "in_progress" },
  });

  return { conference, primaryCallId, secondaryCallId };
}

/** Supervisor whisper: hold customer briefly, speak coach note, restore hold state. */
export async function whisperOnHumanCall(
  callId: string,
  workspaceId: string,
  message: string,
) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call?.telnyxCallControlId) throw new Error("Call not active");
  const text = message.trim();
  if (!text) throw new Error("Whisper message required");

  // Coach note requires a secondary/consult leg — never speak on the customer leg alone.
  const speakTarget =
    call.telnyxCallLegId && !call.telnyxCallLegId.startsWith("mock_")
      ? call.telnyxCallLegId
      : null;
  if (!speakTarget) {
    throw new Error(
      "Coach note needs an active consult or flipped device leg — start a warm transfer first",
    );
  }

  if (!speakTarget.startsWith("mock_")) {
    await telnyxAction(speakTarget, "speak", {
      payload: text,
      voice: "female",
      language: "en-US",
    }).catch(() => undefined);
  }

  return prisma.humanCall.update({
    where: { id: callId },
    data: {
      onHold: call.onHold,
      status: call.status,
      notes: `${call.notes || ""}\n[whisper:${text.slice(0, 120)}]`.trim(),
    },
  });
}

/** Block a caller number workspace-wide (suppression + hangup active call). */
export async function blockCallerFromCall(callId: string, workspaceId: string) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call) throw new Error("Call not found");
  const phone = call.direction === "inbound" ? call.from : call.to;
  const suppressionKey = `${workspaceId}:p:${phone}`;

  await prisma.suppression.upsert({
    where: { suppressionKey },
    create: {
      workspaceId,
      phone,
      suppressionKey,
      reason: "softphone_block",
      source: "softphone",
    },
    update: {
      workspaceId,
      phone,
      reason: "softphone_block",
      source: "softphone",
    },
  });

  await hangupControlLeg(call.telnyxCallControlId);
  if (call.telnyxCallLegId && call.telnyxCallLegId !== call.telnyxCallControlId) {
    await hangupControlLeg(call.telnyxCallLegId);
  }

  const updated = await prisma.humanCall.update({
    where: { id: callId },
    data: {
      status: "completed",
      disposition: `blocked:${phone}`,
      endedAt: new Date(),
      telnyxCallLegId: null,
      notes: `${call.notes || ""}\n[blocked:${phone}]`.trim(),
    },
  });
  await clearAgentPresence(updated);
  return updated;
}

/** Heuristic / LLM AI notes for a softphone call transcript. */
export async function generateHumanCallAiSummary(callId: string, workspaceId: string) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call) throw new Error("Call not found");
  const text = call.transcriptText || call.notes || "";
  let summary =
    text.trim().length > 20
      ? `Softphone call summary: ${text.replace(/\s+/g, " ").slice(0, 280)}`
      : `Softphone call ${call.direction} ${call.from} → ${call.to} (${call.status}).`;

  if (text.trim().length > 40) {
    try {
      const { openAiChatCompletion, getOpenAiApiKey } = await import("@/lib/ai/openai");
      if (getOpenAiApiKey()) {
        const raw = await openAiChatCompletion(
          "Summarize this phone call in 1-2 sentences. Return plain text only.",
          text.slice(0, 6000),
          { temperature: 0.2, maxTokens: 120 },
        );
        if (raw?.trim()) summary = raw.trim();
      }
    } catch (err) {
      console.warn("[human-call] ai summary failed", err);
    }
  }

  return prisma.humanCall.update({
    where: { id: callId },
    data: { aiSummary: summary },
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
  const from = await resolveCallerIdNumber(
    input.workspaceId,
    input.from,
    input.agentUserId,
  );
  if (!from) throw new Error("No active caller ID number configured");

  const { getSoftphonePermissions, requireSoftphonePermission } = await import(
    "./softphone-permissions"
  );
  await requireSoftphonePermission(input.workspaceId, input.agentUserId, "place_call");
  await assertNotDnd(input.workspaceId, input.agentUserId);
  const { allowed } = await getSoftphonePermissions(input.workspaceId, input.agentUserId);
  if (!destination.startsWith("+1") && !allowed.has("international")) {
    throw new Error("International calling is disabled for this user");
  }

  let contactId: string | null = null;
  try {
    const { resolveContactIdForPhone } = await import("@/lib/contacts/activity-timeline");
    contactId = await resolveContactIdForPhone(input.workspaceId, destination);
  } catch {
    // best-effort
  }

  const call = await prisma.humanCall.create({
    data: {
      workspaceId: input.workspaceId,
      from,
      to: destination,
      direction: "outbound",
      status: "initiated",
      agentUserId: input.agentUserId,
      callerIdNumber: from,
      mediaMode: "call_my_phone",
      contactId,
      notes: `call_my_phone:${agentPhone}`,
    },
  });

  try {
    if (!isTelnyxPhoneConfigured()) {
      const mockId = `mock_${call.id}`;
      const updated = await prisma.humanCall.update({
        where: { id: call.id },
        data: { telnyxCallControlId: mockId, status: "ringing" },
      });
      await markOnCallSafe(input.workspaceId, input.agentUserId, true);
      return { call: updated, mode: "mock" };
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
    await markOnCallSafe(input.workspaceId, input.agentUserId, true);

    return { call: updated, mode: "telnyx", bridge: true };
  } catch (err) {
    await prisma.humanCall
      .update({
        where: { id: call.id },
        data: { status: "failed", endedAt: new Date(), disposition: "dial_failed" },
      })
      .catch(() => undefined);
    throw err;
  }
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

  // Do not bridge until the destination answers (webhook kind human_bridge_dest).
  await prisma.humanCall.update({
    where: { id: call.id },
    data: {
      status: "ringing",
      telnyxCallLegId: destControlId,
      notes: `${call.notes || ""}|dest_leg:${destControlId}|awaiting_dest_answer`.trim(),
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
  if (!call.telnyxCallControlId) {
    throw new Error(
      "Call control not linked yet — wait a moment after WebRTC connects, then transfer again",
    );
  }
  await telnyxAction(call.telnyxCallControlId, "transfer", { to: dest });
  const updated = await prisma.humanCall.update({
    where: { id: callId },
    data: { status: "transferred", disposition: `transferred:${dest}`, endedAt: new Date() },
  });
  await clearAgentPresence(updated);
  return updated;
}

/** Warm transfer: hold customer, dial consult leg to target. */
export async function startWarmTransfer(
  callId: string,
  workspaceId: string,
  toE164: string,
  note?: string | null,
) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call?.telnyxCallControlId) throw new Error("Call not active for warm transfer");
  const dest = normalizeE164(toE164);
  const controlId = call.telnyxCallControlId;

  if (!controlId.startsWith("mock_")) {
    await telnyxAction(controlId, "hold");
    const from = call.callerIdNumber || call.from;
    const connectionId = process.env.TELNYX_CONNECTION_ID!.trim();
    const consultLeg = await telnyxRequest<{ data: { call_control_id: string } }>("/calls", {
      method: "POST",
      body: {
        connection_id: connectionId,
        from,
        to: dest,
        client_state: encodeClientState({
          workspaceId,
          humanCallId: call.id,
          kind: "warm_transfer_consult",
          customerControlId: controlId,
        }),
      },
    });
    const consultControlId = consultLeg.data?.call_control_id;
    if (!consultControlId) throw new Error("Consult dial failed");

    const updated = await prisma.humanCall.update({
      where: { id: callId },
      data: {
        onHold: true,
        status: "on_hold",
        telnyxCallLegId: consultControlId,
        notes: note
          ? `${call.notes || ""}\n[Warm transfer to ${dest}: ${note}]`.trim()
          : `${call.notes || ""}\n[Warm transfer consult:${dest}]`.trim(),
      },
    });

    await logHumanCallEvent(workspaceId, callId, "transfer.warm.started", {
      destination: dest,
      customerControlId: controlId,
      consultControlId,
      note: note || null,
      phase: "caller_held_consult_ringing",
    });

    const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
    await enqueueJob({
      jobType: "phone_warm_transfer_timeout",
      queueName: "voice-calls",
      workspaceId,
      payload: { workspaceId, humanCallId: callId, consultControlId },
      idempotencyKey: `phone-warm-timeout-${callId}-${consultControlId}`,
      runAfter: new Date(Date.now() + 45_000),
    });

    return updated;
  }

  const mockConsult = `mock_consult_${call.id}`;
  return prisma.humanCall.update({
    where: { id: callId },
    data: {
      onHold: true,
      status: "on_hold",
      telnyxCallLegId: mockConsult,
      notes: note
        ? `${call.notes || ""}\n[Warm transfer to ${dest}: ${note}]`.trim()
        : call.notes,
    },
  });
}

/** Bridge customer to consult leg and end agent involvement. */
export async function completeWarmTransfer(callId: string, workspaceId: string) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call?.telnyxCallControlId || !call.telnyxCallLegId) {
    throw new Error("No warm transfer in progress");
  }
  if (!(call.notes || "").includes("[warm_consult_answered]")) {
    throw new Error("Wait until the employee answers before completing the transfer");
  }
  const customerId = call.telnyxCallControlId;
  const consultId = call.telnyxCallLegId;

  if (!customerId.startsWith("mock_")) {
    await telnyxAction(customerId, "unhold").catch(() => undefined);
    // Bridge customer ↔ consult. Agent WebRTC media is ended client-side after success.
    await telnyxAction(customerId, "bridge", { call_control_id: consultId });
  }

  await logHumanCallEvent(workspaceId, callId, "transfer.warm.completed", {
    customerControlId: customerId,
    consultControlId: consultId,
    phase: "bridged",
  });

  const updated = await prisma.humanCall.update({
    where: { id: callId },
    data: {
      status: "transferred",
      disposition: `warm_transferred:${consultId}`,
      telnyxCallLegId: null,
      onHold: false,
      endedAt: new Date(),
      notes: `${call.notes || ""}\n[warm_transfer_complete]`.trim(),
    },
  });
  await clearAgentPresence(updated);
  return updated;
}

/** Cancel warm transfer: hang up consult and unhold customer. */
export async function cancelWarmTransfer(callId: string, workspaceId: string) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call) throw new Error("Call not found");
  const consultId = call.telnyxCallLegId;

  if (consultId && !consultId.startsWith("mock_")) {
    await telnyxAction(consultId, "hangup");
  }
  if (call.telnyxCallControlId && !call.telnyxCallControlId.startsWith("mock_")) {
    await telnyxAction(call.telnyxCallControlId, "unhold");
  }

  await logHumanCallEvent(workspaceId, callId, "transfer.warm.cancelled", {
    consultControlId: consultId,
    phase: "returned_caller_to_agent",
  });

  return prisma.humanCall.update({
    where: { id: callId },
    data: {
      telnyxCallLegId: null,
      onHold: false,
      status: "in_progress",
    },
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
    agentUserId?: string | null;
    muted?: boolean;
    onHold?: boolean;
    transferTo?: string;
    record?: boolean;
    warmTransferTo?: string;
    consult?: boolean;
    completeWarmTransfer?: boolean;
    /** Softphone screening accept (unhold + bridge path for softphone-only screening). */
    acceptScreening?: boolean;
    declineScreening?: boolean;
    /** Supervisor session: monitor | whisper | barge + phone */
    supervisorRole?: "monitor" | "whisper" | "barge";
    supervisorPhone?: string;
    supervisorControlId?: string;
    cancelWarmTransfer?: boolean;
    switchLine?: boolean;
    flipTo?: string;
    whisper?: string;
    blockCaller?: boolean;
    startTranscription?: boolean;
    generateAiSummary?: boolean;
    telnyxCallControlId?: string | null;
    webrtcCallId?: string | null;
  },
) {
  if (patch.telnyxCallControlId) {
    return linkHumanCallControlId(
      callId,
      workspaceId,
      patch.telnyxCallControlId,
      patch.webrtcCallId,
    );
  }
  if (patch.completeWarmTransfer) return completeWarmTransfer(callId, workspaceId);
  if (patch.cancelWarmTransfer) return cancelWarmTransfer(callId, workspaceId);
  if (patch.consult && patch.warmTransferTo) {
    return startWarmTransfer(callId, workspaceId, patch.warmTransferTo, patch.notes);
  }
  if (patch.blockCaller) return blockCallerFromCall(callId, workspaceId);
  if (patch.whisper) return whisperOnHumanCall(callId, workspaceId, patch.whisper);
  // acceptScreening may include flipTo for Call Control → cellular audio — handle before bare flipTo.
  if (patch.acceptScreening) {
    const prisma = getPrisma();
    const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
    if (!call?.telnyxCallControlId) throw new Error("Call not found");
    const bridgeTo =
      patch.flipTo ||
      (
        await prisma.softphoneUserSettings.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId,
              userId: patch.agentUserId || call.agentUserId || "",
            },
          },
        })
      )?.forwardToCellular ||
      null;
    if (!bridgeTo) {
      throw new Error(
        "Set Call my phone / cellular number to accept screened calls (no browser audio on held Call Control legs).",
      );
    }
    await telnyxAction(call.telnyxCallControlId, "unhold").catch(() => undefined);
    await prisma.humanCall.update({
      where: { id: callId },
      data: {
        status: "in_progress",
        onHold: false,
        answeredAt: call.answeredAt || new Date(),
        agentUserId: patch.agentUserId || call.agentUserId,
        notes: `${call.notes || ""}\nscreening:accepted`.trim(),
      },
    });
    return flipHumanCall(callId, workspaceId, bridgeTo);
  }
  if (patch.flipTo) return flipHumanCall(callId, workspaceId, patch.flipTo);
  if (patch.startTranscription) return startHumanCallTranscription(callId, workspaceId);
  if (patch.generateAiSummary) return generateHumanCallAiSummary(callId, workspaceId);

  if (patch.supervisorRole && patch.supervisorPhone) {
    const { startSupervisorSession } = await import("./supervisor-service");
    const result = await startSupervisorSession({
      workspaceId,
      supervisorUserId: patch.agentUserId || "supervisor",
      humanCallId: callId,
      role: patch.supervisorRole,
      supervisorPhone: patch.supervisorPhone,
    });
    return getPrisma()
      .humanCall.findFirst({ where: { id: callId, workspaceId } })
      .then((c: { id: string } | null) => {
        if (!c) throw new Error("Call not found");
        return { ...c, supervisorControlId: result.supervisorControlId };
      });
  }
  if (patch.supervisorRole && patch.supervisorControlId) {
    const { updateSupervisorRole } = await import("./supervisor-service");
    await updateSupervisorRole({
      workspaceId,
      humanCallId: callId,
      supervisorControlId: patch.supervisorControlId,
      role: patch.supervisorRole,
    });
    const call = await getPrisma().humanCall.findFirst({ where: { id: callId, workspaceId } });
    if (!call) throw new Error("Call not found");
    return call;
  }

  if (patch.declineScreening) {
    const prisma = getPrisma();
    const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
    if (!call?.telnyxCallControlId) throw new Error("Call not found");
    const ringLegMatch = (call.notes || "").match(/\[ring_legs:([^\]]+)\]/);
    if (ringLegMatch?.[1] && isTelnyxPhoneConfigured()) {
      for (const legId of ringLegMatch[1]
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean)) {
        await telnyxRequest(`/calls/${legId}/actions/hangup`, {
          method: "POST",
          body: {},
        }).catch(() => undefined);
      }
    }
    await telnyxAction(call.telnyxCallControlId, "unhold").catch(() => undefined);
    const { leaveVoicemailOnCall } = await import("./voicemail-service");
    await leaveVoicemailOnCall({
      workspaceId,
      humanCallId: callId,
      telnyxCallControlId: call.telnyxCallControlId,
      userId: patch.agentUserId || call.agentUserId,
    });
    const declined = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
    if (!declined) throw new Error("Call not found");
    return declined;
  }

  if (patch.answer) {
    return answerHumanCall(callId, workspaceId, patch.agentUserId);
  }
  if (patch.hangup) return hangupHumanCall(callId, workspaceId, patch.disposition);
  if (patch.muted !== undefined) {
    return muteHumanCall(callId, workspaceId, patch.muted, patch.agentUserId);
  }
  if (patch.onHold !== undefined) return holdHumanCall(callId, workspaceId, patch.onHold);
  if (patch.transferTo) return transferHumanCall(callId, workspaceId, patch.transferTo);
  if (patch.record !== undefined) return recordHumanCall(callId, workspaceId, patch.record);
  if (patch.switchLine) {
    // Client-driven line switch; acknowledge without server-side leg changes.
    const call = await getPrisma().humanCall.findFirst({ where: { id: callId, workspaceId } });
    if (!call) throw new Error("Call not found");
    return call;
  }

  const prisma = getPrisma();
  const data: Record<string, unknown> = {};
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.disposition !== undefined) data.disposition = patch.disposition;
  const updated = await prisma.humanCall.update({
    where: { id: callId },
    data,
  });

  // Disposition-driven product events (automation + CRM).
  if (patch.disposition) {
    const customerPhone = updated.direction === "inbound" ? updated.from : updated.to;
    try {
      const contact = await prisma.contact.findFirst({
        where: { workspaceId, phone: customerPhone },
      });
      if (
        contact &&
        /missed|no[_ -]?answer|voicemail/i.test(patch.disposition)
      ) {
        const { emitAutomationEvent } = await import("@/lib/automations/events");
        await emitAutomationEvent(workspaceId, "call.missed", contact.id, {
          humanCallId: updated.id,
          direction: updated.direction,
          disposition: patch.disposition,
        }).catch(() => undefined);
      }
      if (/callback/i.test(patch.disposition)) {
        const { publishCallbackScheduled } = await import("@/lib/crm/events");
        await publishCallbackScheduled({
          workspaceId,
          contactId: contact?.id || null,
          callId: updated.id,
          phone: customerPhone,
        }).catch(() => undefined);
      }
    } catch (err) {
      console.warn("[human-call] disposition event failed", callId, err);
    }
  }

  return updated;
}

function decodeHumanClientState(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string") return {};
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return {};
  }
}

export async function processHumanCallWebhookEvent(input: {
  eventType: string;
  humanCallId?: string;
  eventPayload: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const clientState = decodeHumanClientState(input.eventPayload.client_state);
  const eventControlId = input.eventPayload.call_control_id
    ? String(input.eventPayload.call_control_id)
    : "";

  let call = input.humanCallId
    ? await prisma.humanCall.findUnique({ where: { id: input.humanCallId } })
    : null;

  if (!call && clientState.humanCallId) {
    call = await prisma.humanCall.findUnique({ where: { id: String(clientState.humanCallId) } });
  }
  if (!call && eventControlId) {
    call = await prisma.humanCall.findFirst({
      where: {
        OR: [{ telnyxCallControlId: eventControlId }, { telnyxCallLegId: eventControlId }],
      },
    });
  }
  if (!call) return { ok: false, reason: "human_call_not_found" };

  const secondaryKinds = new Set([
    "queue_member_ring",
    "simultaneous_ring",
    "conference_leg",
    "supervisor_leg",
    "warm_transfer_consult",
    "call_flip",
    "call_screening",
    "human_bridge_dest",
    "human_bridge_agent",
  ]);
  // After call flip, the flipped device becomes telnyxCallControlId but may still
  // carry call_flip client_state — treat events on the active control id as primary.
  const isActiveControl =
    Boolean(eventControlId) && eventControlId === call.telnyxCallControlId;
  const isSecondaryLeg =
    secondaryKinds.has(String(clientState.kind || "")) && !isActiveControl;

  const statusMap: Record<string, string> = {
    "call.initiated": "initiated",
    "call.ringing": "ringing",
    "call.answered": "in_progress",
    "call.bridged": "in_progress",
    "call.hangup": "completed",
  };

  const nextStatus = statusMap[input.eventType];
  const patch: Record<string, unknown> = {};
  // Never let secondary-leg events overwrite the customer call status to completed mid-transfer.
  // Keep queue waiting state until an agent actually answers (softphone / queue member).
  const preserveQueued =
    call.status === "queued" &&
    (input.eventType === "call.answered" || input.eventType === "call.bridged");
  if (
    nextStatus &&
    !preserveQueued &&
    !(isSecondaryLeg && input.eventType === "call.hangup" && call.status === "transferred")
  ) {
    if (!(isSecondaryLeg && ["call.initiated", "call.ringing"].includes(input.eventType))) {
      if (!(isSecondaryLeg && input.eventType === "call.hangup")) {
        patch.status = nextStatus;
      }
    }
  }
  if (patch.status === "completed") patch.endedAt = new Date();
  if (
    input.eventType === "call.answered" &&
    !call.answeredAt &&
    !isSecondaryLeg &&
    call.status !== "queued"
  ) {
    patch.answeredAt = new Date();
  }
  if (input.eventType === "call.recording.saved") {
    const urls = input.eventPayload.recording_urls as Record<string, string> | undefined;
    patch.recordingUrl = urls?.mp3 || urls?.wav || null;
    // Do not mark call completed on recording.saved.
    const recordingUrl = (patch.recordingUrl as string | null) || null;
    const isVoicemail =
      call.status === "voicemail" ||
      String(call.disposition || "").startsWith("voicemail:");
    if (recordingUrl && isVoicemail) {
      const duration =
        Number(
          (input.eventPayload as { recording_duration_ms?: number }).recording_duration_ms ||
            (input.eventPayload as { duration_millis?: number }).duration_millis ||
            0,
        ) || null;
      const { attachVoicemailRecordingAndTranscribe } = await import("./voicemail-service");
      await attachVoicemailRecordingAndTranscribe({
        workspaceId: call.workspaceId,
        humanCallId: call.id,
        recordingUrl,
        durationSeconds: duration ? Math.round(duration / 1000) : null,
      }).catch((err) => console.warn("[phone] voicemail transcript failed", err));
    }
  }
  if (input.eventType === "call.transcription" || input.eventType === "call.transcription.received") {
    const transcript =
      (input.eventPayload.transcription_data as { transcript?: string } | undefined)?.transcript ||
      (input.eventPayload.transcript as string | undefined) ||
      "";
    if (transcript) {
      patch.transcriptText = `${call.transcriptText || ""}${call.transcriptText ? "\n" : ""}${transcript}`.trim();
    }
  }
  if (input.eventType === "call.transcription.completed") {
    const full =
      (input.eventPayload.transcription_data as { transcript?: string } | undefined)?.transcript ||
      (input.eventPayload.transcript as string | undefined) ||
      "";
    if (full) patch.transcriptText = full;
    // Do not mark call completed on transcription.completed.
  }

  // A hangup while still ringing/initiated (never answered) is a missed call.
  const wasAnswered = ["in_progress", "on_hold", "transferred", "completed", "parked"].includes(
    call.status,
  );
  const isMissed =
    input.eventType === "call.hangup" && !wasAnswered && !isSecondaryLeg;
  const cause = String(
    input.eventPayload.hangup_cause || input.eventPayload.sip_hangup_cause || "",
  ).toLowerCase();
  if (isMissed) {
    patch.disposition = call.disposition || `missed:${cause || "no_answer"}`;
  }

  if (Object.keys(patch).length) {
    await prisma.humanCall.update({
      where: { id: call.id },
      data: patch,
    });
  }

  if (patch.status === "completed" || patch.status === "missed") {
    const refreshed = await prisma.humanCall.findUnique({ where: { id: call.id } });
    if (refreshed) await clearAgentPresence(refreshed);
  }

  // Primary hangup: tear down the secondary leg (consult / flip / call-my-phone dest).
  if (
    input.eventType === "call.hangup" &&
    !isSecondaryLeg &&
    call.telnyxCallLegId &&
    call.telnyxCallLegId !== eventControlId
  ) {
    await hangupControlLeg(call.telnyxCallLegId);
  }
  // Secondary hangup on an active bridged call: hang up the customer/primary leg too
  // (except warm consult cancel / dest-no-answer handled below).
  if (
    input.eventType === "call.hangup" &&
    isSecondaryLeg &&
    ["in_progress", "on_hold"].includes(call.status) &&
    String(clientState.kind || "") !== "warm_transfer_consult" &&
    String(clientState.kind || "") !== "human_bridge_dest" &&
    call.telnyxCallControlId &&
    call.telnyxCallControlId !== eventControlId
  ) {
    await hangupControlLeg(call.telnyxCallControlId);
  }

  if (input.eventType === "call.recording.saved" && patch.recordingUrl) {
    try {
      const customerPhone = call.direction === "inbound" ? call.from : call.to;
      const contact = await prisma.contact.findFirst({
        where: { workspaceId: call.workspaceId, phone: customerPhone },
      });
      const { publishRecordingReady } = await import("@/lib/crm/events");
      await publishRecordingReady({
        workspaceId: call.workspaceId,
        contactId: contact?.id || null,
        callId: call.id,
        recordingUrl: String(patch.recordingUrl),
        direction: call.direction === "outbound" ? "outbound" : "inbound",
      }).catch(() => undefined);
    } catch (err) {
      console.warn("[human-call] crm recording event failed", call.id, err);
    }
  }

  // Call-my-phone: when the agent answers their cell, dial destination + bridge.
  if (input.eventType === "call.answered") {
    const kind = String(clientState.kind || "");
    const parentId = String(
      clientState.parentCallControlId || clientState.customerControlId || "",
    );

    if (kind === "human_bridge_agent" && clientState.destination) {
      await continueCallMyPhoneBridge({
        workspaceId: call.workspaceId,
        humanCallId: call.id,
        agentCallControlId: eventControlId || call.telnyxCallControlId || "",
        destination: String(clientState.destination),
      }).catch((err) => console.warn("[human-call] bridge continue failed", err));
    }

    if (kind === "human_bridge_dest" && clientState.agentCallControlId && eventControlId) {
      await telnyxAction(String(clientState.agentCallControlId), "bridge", {
        call_control_id: eventControlId,
      }).catch(() => undefined);
      await prisma.humanCall.update({
        where: { id: call.id },
        data: {
          status: "in_progress",
          answeredAt: call.answeredAt || new Date(),
          notes: `${call.notes || ""}\n[call_my_phone_bridged]`.trim(),
        },
      });
    }

    // Queue / simultaneous ring answer → bridge agent PSTN leg to waiting customer.
    if (
      (kind === "queue_member_ring" || kind === "simultaneous_ring") &&
      parentId &&
      eventControlId
    ) {
      await telnyxAction(parentId, "playback_stop").catch(() => undefined);
      await telnyxAction(parentId, "unhold").catch(() => undefined);
      await telnyxAction(parentId, "bridge", { call_control_id: eventControlId }).catch(() =>
        undefined,
      );
      // Cancel sibling ring legs so multiple agents cannot answer the same caller.
      const ringLegMatch = (call.notes || "").match(/\[ring_legs:([^\]]+)\]/);
      if (ringLegMatch?.[1]) {
        for (const legId of ringLegMatch[1]
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)) {
          if (legId !== eventControlId) await hangupControlLeg(legId);
        }
      }
      await prisma.humanCall.update({
        where: { id: call.id },
        data: {
          status: "in_progress",
          answeredAt: new Date(),
          telnyxCallLegId: eventControlId,
          agentUserId: clientState.userId ? String(clientState.userId) : call.agentUserId,
        },
      });
      if (clientState.userId) {
        await markOnCallSafe(call.workspaceId, String(clientState.userId), true);
      }
    }

    // Conference participant answered → join conference.
    if (kind === "conference_leg" && clientState.conferenceId && eventControlId) {
      const conference = await prisma.conferenceCall.findUnique({
        where: { id: String(clientState.conferenceId) },
      });
      if (conference?.telnyxConferenceId) {
        await telnyxRequest(`/conferences/${conference.telnyxConferenceId}/actions/join`, {
          method: "POST",
          body: { call_control_id: eventControlId },
        }).catch(() => undefined);
      }
      await prisma.conferenceParticipant.updateMany({
        where: { humanCallId: call.id, conferenceId: conference?.id },
        data: { status: "joined", telnyxCallControlId: eventControlId },
      });
      await prisma.humanCall.update({
        where: { id: call.id },
        data: { status: "in_progress", answeredAt: new Date() },
      });
    }

    // Supervisor listen / whisper / barge leg answered → join with supervisor_role.
    if (kind === "supervisor_leg" && eventControlId) {
      const role = String(clientState.supervisorRole || "monitor") as
        | "monitor"
        | "whisper"
        | "barge";
      const { joinSupervisorOnAnswer } = await import("./supervisor-service");
      await joinSupervisorOnAnswer({
        workspaceId: call.workspaceId,
        humanCallId: call.id,
        supervisorControlId: eventControlId,
        role,
      }).catch((err) => console.warn("[human-call] supervisor join failed", err));
    }

    // Call flip: bridge device leg to held customer, then swap media to the flip leg.
    if (kind === "call_flip" && parentId && eventControlId) {
      await telnyxAction(parentId, "unhold").catch(() => undefined);
      await telnyxAction(parentId, "bridge", { call_control_id: eventControlId }).catch(() =>
        undefined,
      );
      await prisma.humanCall.update({
        where: { id: call.id },
        data: {
          status: "in_progress",
          onHold: false,
          telnyxCallControlId: eventControlId,
          telnyxCallLegId: parentId,
          mediaMode: "call_my_phone",
          // Mark flip completed so hangup on the active device is not treated as secondary.
          notes: `${call.notes || ""}\n[call_flip_active]`.trim(),
        },
      });
    }

    // Call screening: agent phone answered — gather accept/decline on the agent leg.
    if (kind === "call_screening" && eventControlId) {
      await telnyxAction(eventControlId, "gather_using_speak", {
        payload: `Call from ${call.from}. Press 1 to accept, press 2 to send to voicemail.`,
        voice: "female",
        language: "en-US",
        valid_digits: "12",
        maximum_digits: 1,
        minimum_digits: 1,
        timeout_millis: 15000,
        client_state: encodeClientState({
          workspaceId: call.workspaceId,
          humanCallId: call.id,
          kind: "call_screening",
          userId: clientState.userId || null,
          parentCallControlId: clientState.parentCallControlId || call.telnyxCallControlId,
        }),
      }).catch(() => undefined);
    }

    // Warm transfer consult answered: speak note to consult; keep customer on hold.
    if (kind === "warm_transfer_consult" && eventControlId) {
      const noteMatch = (call.notes || "").match(/\[Warm transfer[^\]]*:\s*([^\]]+)\]/i);
      const coach = noteMatch?.[1]?.trim();
      if (coach) {
        await telnyxAction(eventControlId, "speak", {
          payload: coach,
          voice: "female",
          language: "en-US",
        }).catch(() => undefined);
      }
      await prisma.humanCall.update({
        where: { id: call.id },
        data: {
          telnyxCallLegId: eventControlId,
          status: "on_hold",
          onHold: true,
          notes: `${call.notes || ""}\n[warm_consult_answered]`.trim(),
        },
      });
      await logHumanCallEvent(call.workspaceId, call.id, "transfer.warm.consult_answered", {
        consultControlId: eventControlId,
        phase: "consult_answered_caller_still_held",
      });
    }

    // Primary softphone answer → start transcription for AI notes.
    if (!isSecondaryLeg && call.telnyxCallControlId && !call.telnyxCallControlId.startsWith("mock_")) {
      const { startCallTranscription } = await import("@/lib/voice/telnyx/assistant-sync");
      await startCallTranscription(call.telnyxCallControlId).catch(() => undefined);
    }
  }

  // Screening agent hung up / declined without DTMF → send customer to voicemail.
  // Never dump to voicemail after accept/bridge or once the customer call is live.
  if (
    input.eventType === "call.hangup" &&
    String(clientState.kind || "") === "call_screening" &&
    call.telnyxCallControlId &&
    !isActiveControl
  ) {
    const notes = call.notes || "";
    const alreadyAccepted =
      notes.includes("screening:accepted") ||
      ["in_progress", "completed", "transferred", "voicemail", "parked"].includes(call.status) ||
      Boolean(call.answeredAt);
    if (!alreadyAccepted) {
      const { leaveVoicemailOnCall } = await import("./voicemail-service");
      await leaveVoicemailOnCall({
        workspaceId: call.workspaceId,
        humanCallId: call.id,
        telnyxCallControlId: call.telnyxCallControlId,
        userId: clientState.userId ? String(clientState.userId) : null,
      }).catch(() => undefined);
    }
  }

  // Call-my-phone destination never answered → hang up agent leg and complete.
  if (
    input.eventType === "call.hangup" &&
    String(clientState.kind || "") === "human_bridge_dest" &&
    !["in_progress", "completed", "transferred"].includes(call.status)
  ) {
    await hangupControlLeg(call.telnyxCallControlId);
    await prisma.humanCall.update({
      where: { id: call.id },
      data: {
        status: "completed",
        endedAt: new Date(),
        disposition: call.disposition || "missed:dest_no_answer",
        telnyxCallLegId: null,
      },
    });
    await clearAgentPresence(call);
  }

  if (isMissed) {
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
      const { publishCallCompleted } = await import("@/lib/crm/events");
      await publishCallCompleted({
        workspaceId: call.workspaceId,
        contactId: contact?.id || null,
        callId: call.id,
        direction: "missed",
        from: call.from,
        to: call.to,
        disposition: String(patch.disposition || "missed"),
        notes: call.notes,
      }).catch(() => undefined);
    } catch (err) {
      console.warn("[human-call] missed-call event failed", call.id, err);
    }
  } else if (input.eventType === "call.hangup" && wasAnswered) {
    try {
      const customerPhone = call.direction === "inbound" ? call.from : call.to;
      const contact = await prisma.contact.findFirst({
        where: { workspaceId: call.workspaceId, phone: customerPhone },
      });
      const durationSeconds =
        call.answeredAt && patch.endedAt instanceof Date
          ? Math.max(0, Math.round((patch.endedAt.getTime() - call.answeredAt.getTime()) / 1000))
          : null;
      const { publishCallCompleted } = await import("@/lib/crm/events");
      await publishCallCompleted({
        workspaceId: call.workspaceId,
        contactId: contact?.id || null,
        callId: call.id,
        direction: call.direction === "outbound" ? "outbound" : "inbound",
        from: call.from,
        to: call.to,
        durationSeconds,
        disposition: call.disposition,
        recordingUrl: (patch.recordingUrl as string) || call.recordingUrl,
        notes: call.notes,
      }).catch(() => undefined);
    } catch (err) {
      console.warn("[human-call] crm completed event failed", call.id, err);
    }
  }

  return { ok: true, callId: call.id, missed: isMissed };
}
