import { getPrisma } from "@/lib/server/db";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { telnyxRequest } from "@/lib/server/telnyx/client";
import { normalizeE164 } from "@/lib/server/phone/normalize";
import { resolveCallerIdNumber } from "@/lib/server/phone/settings";
import { mapHumanCallToDto } from "@/lib/server/phone/map-call";
import { decodeTelnyxClientState } from "@/lib/server/phone/telnyx-call-actions";
import type { PhoneCallDto } from "@/lib/phone/types";

function encodeClientState(data: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

export function isTelnyxPhoneConfigured() {
  return Boolean(
    process.env.TELNYX_API_KEY?.trim() &&
      (process.env.TELNYX_CONNECTION_ID?.trim() || process.env.TELNYX_CALL_CONTROL_APP_ID?.trim()),
  );
}

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
  const row = await prisma.phoneNumber.findFirst({
    where: { workspaceId, e164, status: "Active" },
    select: { id: true, friendlyName: true },
  });
  return row;
}

export async function listCalls(
  workspaceId: string,
  query: {
    limit?: number;
    page?: number;
    direction?: string;
    status?: string;
    q?: string;
    numberId?: string;
    filter?: string;
    from?: string;
    to?: string;
  },
): Promise<{ data: PhoneCallDto[]; total: number }> {
  const prisma = getPrisma();
  const limit = Math.min(query.limit ?? 12, 100);
  const page = Math.max(0, query.page ?? 0);
  const where: Record<string, unknown> = { workspaceId };

  if (query.direction === "inbound" || query.direction === "outbound") {
    where.direction = query.direction;
  }
  if (query.numberId && query.numberId !== "all") {
    where.phoneNumberId = query.numberId;
  }
  if (query.from || query.to) {
    where.startedAt = {};
    if (query.from) (where.startedAt as Record<string, Date>).gte = new Date(query.from);
    if (query.to) (where.startedAt as Record<string, Date>).lte = new Date(query.to);
  }

  if (query.filter === "missed") {
    where.OR = [{ status: "missed" }, { status: "no_answer" }, { disposition: { contains: "no_answer" } }];
  } else if (query.filter === "voicemail") {
    where.OR = [{ status: "voicemail" }, { disposition: { contains: "voicemail" } }];
  } else if (query.filter === "unhandled") {
    where.callbackNeeded = true;
    where.handled = false;
  }

  if (query.q?.trim()) {
    const q = query.q.trim();
    where.OR = [
      { from: { contains: q } },
      { to: { contains: q } },
      { notes: { contains: q, mode: "insensitive" } },
      { disposition: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.humanCall.count({ where }),
    prisma.humanCall.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: page * limit,
      take: limit,
    }),
  ]);

  const contactIds = rows.map((r) => r.contactId).filter(Boolean) as string[];
  const contacts = contactIds.length
    ? await prisma.contact.findMany({ where: { id: { in: contactIds } } })
    : [];
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  return {
    total,
    data: rows.map((r) => mapHumanCallToDto(r, { contact: r.contactId ? contactMap.get(r.contactId) : null })),
  };
}

export async function getCallDetail(workspaceId: string, id: string): Promise<PhoneCallDto | null> {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id, workspaceId } });
  if (!call) return null;

  const [contact, notes, vm, pn] = await Promise.all([
    call.contactId ? prisma.contact.findUnique({ where: { id: call.contactId } }) : null,
    prisma.humanCallNote.findMany({
      where: { humanCallId: call.id },
      orderBy: { createdAt: "asc" },
    }) as Promise<import("@prisma/client").HumanCallNote[]>,
    prisma.voicemailMessage.findFirst({
      where: { workspaceId, humanCallId: call.id },
      orderBy: { createdAt: "desc" },
    }),
    call.phoneNumberId
      ? prisma.phoneNumber.findUnique({ where: { id: call.phoneNumberId } })
      : call.callerIdNumber
        ? prisma.phoneNumber.findFirst({ where: { workspaceId, e164: call.callerIdNumber } })
        : null,
  ]);

  return mapHumanCallToDto(call, {
    contact,
    callNotes: notes,
    voicemail: vm,
    numberLabel: pn?.friendlyName ?? null,
    phoneNumber: pn,
  });
}

export async function patchCall(
  workspaceId: string,
  id: string,
  patch: {
    handled?: boolean;
    disposition?: string;
    callbackNeeded?: boolean;
    note?: string;
  },
) {
  const prisma = getPrisma();
  const existing = await prisma.humanCall.findFirst({ where: { id, workspaceId } });
  if (!existing) return null;

  const userId = await resolveInternalUserId();
  if (patch.note?.trim()) {
    await prisma.humanCallNote.create({
      data: {
        workspaceId,
        humanCallId: id,
        content: patch.note.trim(),
        createdByUserId: userId,
      },
    });
  }

  await prisma.humanCall.update({
    where: { id },
    data: {
      ...(patch.handled !== undefined ? { handled: patch.handled } : {}),
      ...(patch.disposition !== undefined ? { disposition: patch.disposition } : {}),
      ...(patch.callbackNeeded !== undefined ? { callbackNeeded: patch.callbackNeeded } : {}),
    },
  });
  return getCallDetail(workspaceId, id);
}

export async function createWebRtcOutboundCall(input: {
  workspaceId: string;
  to: string;
  from?: string | null;
  source?: "dialer" | "power_dialer" | "callback" | "inbound";
  webrtcCallId?: string | null;
  powerDialerAttemptId?: string | null;
  idempotencyKey?: string;
}) {
  const prisma = getPrisma();
  const agentUserId = await resolveInternalUserId();
  const to = normalizeE164(input.to);
  const from = await resolveCallerIdNumber(input.workspaceId, input.from);
  if (!from) throw new Error("No active caller ID number configured");

  const pn = await resolvePhoneNumberId(input.workspaceId, from);
  const contactId = await resolveContactId(input.workspaceId, to);

  if (input.idempotencyKey) {
    const prior = await prisma.humanCall.findFirst({
      where: {
        workspaceId: input.workspaceId,
        metadata: { path: ["idempotencyKey"], equals: input.idempotencyKey },
      },
    });
    if (prior) return { call: prior, mode: "webrtc" as const };
  }

  const call = await prisma.humanCall.create({
    data: {
      workspaceId: input.workspaceId,
      from,
      to,
      direction: "outbound",
      status: "initiated",
      agentUserId,
      callerIdNumber: from,
      phoneNumberId: pn?.id ?? null,
      contactId,
      mediaMode: "webrtc",
      source: input.source || "dialer",
      notes: input.webrtcCallId ? `webrtc:${input.webrtcCallId}` : "webrtc",
      metadata: {
        idempotencyKey: input.idempotencyKey ?? null,
        powerDialerAttemptId: input.powerDialerAttemptId ?? null,
      },
    },
  });

  if (input.powerDialerAttemptId) {
    await prisma.powerDialerAttempt.updateMany({
      where: { id: input.powerDialerAttemptId, workspaceId: input.workspaceId },
      data: { humanCallId: call.id, status: "dialing", startedAt: new Date() },
    });
  }

  await prisma.humanCallEvent.create({
    data: {
      workspaceId: input.workspaceId,
      humanCallId: call.id,
      eventType: "call.requested",
      payload: { source: input.source, to, from },
    },
  });

  return { call, mode: "webrtc" as const };
}

export async function registerInboundAnswer(input: {
  workspaceId: string;
  humanCallId: string;
  webrtcCallId?: string | null;
}) {
  const prisma = getPrisma();
  const agentUserId = await resolveInternalUserId();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call) throw new Error("Call not found");

  const notes = `${(call.notes || "").replace(/webrtc:[^\s]+/g, "").trim()} ${input.webrtcCallId ? `webrtc:${input.webrtcCallId}` : ""}`.trim();
  const meta = (call.metadata || {}) as Record<string, unknown>;
  const awaitingBridge = meta.inboundBridge === "dial_agent";
  const updated = await prisma.humanCall.update({
    where: { id: call.id },
    data: {
      status: "in_progress",
      agentUserId,
      mediaMode: "webrtc",
      answeredAt: call.answeredAt || new Date(),
      notes,
      metadata: { ...meta, ringTimeoutAt: null },
    },
  });

  if (!awaitingBridge) {
    const { maybeStartCallRecordingOnAnswer } = await import("@/lib/server/phone/recording-runtime");
    await maybeStartCallRecordingOnAnswer({
      workspaceId: input.workspaceId,
      humanCallId: call.id,
      telnyxCallControlId: call.telnyxCallControlId,
    });
  } else {
    const { phoneServerLog } = await import("@/lib/server/phone/phone-log");
    phoneServerLog("inbound-webrtc-bridge", "client_reported_answer_ui_only", {
      humanCallId: call.id,
      webrtcCallId: input.webrtcCallId || null,
      note: "bridge_waits_for_telnyx_call_answered_webhook",
    });
  }

  return updated;
}

export async function linkHumanCallControlId(
  workspaceId: string,
  callId: string,
  telnyxCallControlId: string,
  webrtcCallId?: string | null,
) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({ where: { id: callId, workspaceId } });
  if (!call) return null;

  const controlId = telnyxCallControlId?.trim() || "";
  const prevMeta = (call.metadata || {}) as Record<string, unknown>;
  const patch: {
    telnyxCallControlId?: string;
    notes?: string;
    metadata?: Record<string, unknown>;
  } = {};
  if (webrtcCallId) {
    patch.notes = `${call.notes || ""} webrtc:${webrtcCallId}`.trim();
  }
  if (controlId) {
    patch.telnyxCallControlId = call.telnyxCallControlId || controlId;
    if (call.direction === "outbound") {
      patch.metadata = {
        ...prevMeta,
        browserCallControlId: prevMeta.browserCallControlId || controlId,
      };
    }
  }

  const updated = await prisma.humanCall.update({
    where: { id: callId },
    data: patch,
  });

  if (controlId && isTelnyxPhoneConfigured()) {
    const { telnyxCallControlPath } = await import("@/lib/server/phone/telnyx-call-actions");
    await telnyxRequest(telnyxCallControlPath(controlId, "/actions/update_client_state"), {
      method: "POST",
      body: {
        client_state: encodeClientState({
          workspaceId,
          humanCallId: callId,
          kind: "human",
        }),
      },
    }).catch(() => undefined);
  }
  return updated;
}

export async function handleInboundCall(input: {
  workspaceId: string;
  fromE164: string;
  toE164: string;
  telnyxCallControlId?: string;
}) {
  const { processInboundCallInitiated } = await import("@/lib/server/phone/inbound-runtime");
  return processInboundCallInitiated(input);
}

function decodeClientState(raw: unknown): Record<string, unknown> {
  return decodeTelnyxClientState(raw);
}

async function findHumanCallForTelnyxEvent(
  prisma: ReturnType<typeof getPrisma>,
  clientState: Record<string, unknown>,
  eventControlId: string,
) {
  if (clientState.humanCallId) {
    const byId = await prisma.humanCall.findUnique({
      where: { id: String(clientState.humanCallId) },
    });
    if (byId) return byId;
  }

  if (eventControlId) {
    const byControl = await prisma.humanCall.findFirst({
      where: {
        OR: [{ telnyxCallControlId: eventControlId }, { telnyxCallLegId: eventControlId }],
      },
    });
    if (byControl) return byControl;
  }

  if (!eventControlId) return null;

  const metaMatch = await prisma.humanCall.findFirst({
    where: {
      OR: [
        { metadata: { path: ["callerCallControlId"], equals: eventControlId } },
        { metadata: { path: ["browserCallControlId"], equals: eventControlId } },
        { metadata: { path: ["agentCallControlId"], equals: eventControlId } },
      ],
    },
    orderBy: { startedAt: "desc" },
  });
  return metaMatch;
}

export async function processHumanCallWebhookEvent(input: {
  eventType: string;
  eventPayload: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const clientState = decodeClientState(input.eventPayload.client_state);
  const eventControlId = input.eventPayload.call_control_id
    ? String(input.eventPayload.call_control_id)
    : "";

  if (
    input.eventType === "call.playback.ended" ||
    input.eventType === "call.speak.ended"
  ) {
    const { handleVoicemailGreetingMediaEnded } = await import("@/lib/server/phone/voicemail-runtime");
    const vm = await handleVoicemailGreetingMediaEnded({
      eventType: input.eventType,
      eventPayload: input.eventPayload,
      clientState,
    });
    if (vm.handled) return { ok: true, voicemail: true };
  }

  let call = await findHumanCallForTelnyxEvent(prisma, clientState, eventControlId);
  if (!call) return { ok: false, reason: "human_call_not_found" };

  if (input.eventType === "call.recording.saved" && clientState.humanCallId) {
    const canonicalId = String(clientState.humanCallId);
    if (call.id !== canonicalId) {
      const canonical = await prisma.humanCall.findUnique({ where: { id: canonicalId } });
      if (canonical) call = canonical;
    }
  }

  const metaBefore = (call.metadata || {}) as Record<string, unknown>;
  if (clientState.kind === "webrtc_agent_leg" && clientState.humanCallId) {
    const { patchInboundSession } = await import("@/lib/server/phone/inbound-session");
    if (input.eventType === "call.ringing") {
      await prisma.humanCall.update({
        where: { id: call.id },
        data: {
          metadata: patchInboundSession(metaBefore, { inboundBridgeStatus: "browser_ringing" }),
        },
      });
    }
    if (input.eventType === "call.answered") {
      await prisma.humanCall.update({
        where: { id: call.id },
        data: {
          metadata: patchInboundSession(metaBefore, { inboundBridgeStatus: "browser_answered" }),
        },
      });
    }
  }

  if (
    input.eventType === "call.answered" &&
    clientState.kind === "webrtc_agent_leg" &&
    clientState.parentCallControlId &&
    clientState.humanCallId
  ) {
    const { completeWebRtcAgentLegAnswer } = await import(
      "@/lib/server/phone/inbound-webrtc-bridge"
    );
    await completeWebRtcAgentLegAnswer({
      parentCallControlId: String(clientState.parentCallControlId),
      agentCallControlId: eventControlId,
      humanCallId: String(clientState.humanCallId),
      workspaceId: call.workspaceId,
    }).catch(() => undefined);
  }

  const statusMap: Record<string, string> = {
    "call.initiated": "initiated",
    "call.ringing": "ringing",
    "call.answered": "in_progress",
    "call.bridged": "in_progress",
    "call.hangup": "completed",
  };

  const patch: Record<string, unknown> = {};
  if (eventControlId) {
    if (!call.telnyxCallControlId) {
      patch.telnyxCallControlId = eventControlId;
    }
    if (call.direction === "outbound") {
      const prevMeta = metaBefore as Record<string, unknown>;
      patch.metadata = {
        ...prevMeta,
        ...(patch.metadata as Record<string, unknown> | undefined),
        browserCallControlId: prevMeta.browserCallControlId || eventControlId,
      };
    }
  }
  const nextStatus = statusMap[input.eventType];
  const wasAnswered = Boolean(call.answeredAt) || call.status === "in_progress";
  if (nextStatus && !(input.eventType === "call.hangup" && call.status === "voicemail")) {
    patch.status = nextStatus;
  }
  if (patch.status === "completed" && call.status !== "voicemail") patch.endedAt = new Date();
  const meta = (call.metadata || {}) as { inboundBridge?: string };
  const awaitingWebrtcBridge = meta.inboundBridge === "dial_agent";
  if (
    input.eventType === "call.answered" &&
    !call.answeredAt &&
    !(awaitingWebrtcBridge && clientState.kind !== "webrtc_agent_leg")
  ) {
    patch.answeredAt = new Date();
    const { maybeStartCallRecordingOnAnswer } = await import("@/lib/server/phone/recording-runtime");
    await maybeStartCallRecordingOnAnswer({
      workspaceId: call.workspaceId,
      humanCallId: call.id,
      telnyxCallControlId: call.telnyxCallControlId || eventControlId,
    });
  }
  if (input.eventType === "call.bridged" && awaitingWebrtcBridge) {
    const { markInboundCallBridged } = await import("@/lib/server/phone/inbound-webrtc-bridge");
    await markInboundCallBridged({
      humanCallId: call.id,
      agentCallControlId: eventControlId || undefined,
    });
    const { maybeStartCallRecordingOnAnswer } = await import("@/lib/server/phone/recording-runtime");
    const metaRecord = metaBefore as Record<string, unknown>;
    const pstnControl =
      typeof metaRecord.callerCallControlId === "string" && metaRecord.callerCallControlId
        ? metaRecord.callerCallControlId
        : call.telnyxCallControlId || eventControlId;
    await maybeStartCallRecordingOnAnswer({
      workspaceId: call.workspaceId,
      humanCallId: call.id,
      telnyxCallControlId: pstnControl,
    });
  }

  if (
    input.eventType === "call.hangup" &&
    clientState.kind === "webrtc_agent_leg" &&
    clientState.parentCallControlId &&
    clientState.humanCallId
  ) {
    const sessionMeta = metaBefore as { inboundBridge?: string };
    if (sessionMeta.inboundBridge === "dial_agent") {
      const { handleInboundAgentLegNoAnswer } = await import(
        "@/lib/server/phone/inbound-agent-no-answer"
      );
      const hangupCause = input.eventPayload.hangup_cause
        ? String(input.eventPayload.hangup_cause)
        : undefined;
      await handleInboundAgentLegNoAnswer({
        workspaceId: call.workspaceId,
        humanCallId: String(clientState.humanCallId),
        pstnCallControlId: String(clientState.parentCallControlId),
        phoneNumberId: call.phoneNumberId,
        hangupCause,
      }).catch(() => undefined);
    }
  }
  if (input.eventType === "call.recording.saved") {
    const urls = input.eventPayload.recording_urls as Record<string, string> | undefined;
    const recordingUrl = urls?.mp3 || urls?.wav || null;
    patch.recordingUrl = recordingUrl;
    const recordingId = input.eventPayload.recording_id
      ? String(input.eventPayload.recording_id)
      : null;
    if (recordingId) {
      const prevMeta = (call.metadata || {}) as Record<string, unknown>;
      patch.metadata = { ...prevMeta, ...(patch.metadata as object), telnyxRecordingId: recordingId };
    }
    const isVoicemail =
      call.status === "voicemail" || String(call.disposition || "").startsWith("voicemail:");
    if (recordingUrl && isVoicemail) {
      const durationMs =
        Number(
          (input.eventPayload as { recording_duration_ms?: number }).recording_duration_ms ||
            (input.eventPayload as { duration_millis?: number }).duration_millis ||
            0,
        ) || null;
      const { attachVoicemailRecording } = await import("@/lib/server/phone/voicemail-runtime");
      await attachVoicemailRecording({
        workspaceId: call.workspaceId,
        humanCallId: call.id,
        recordingUrl,
        durationSeconds: durationMs ? Math.round(durationMs / 1000) : null,
      });
    }
  }

  const hangupCause = input.eventPayload.hangup_cause
    ? String(input.eventPayload.hangup_cause)
    : "";
  if (input.eventType === "call.hangup") {
    if (hangupCause.includes("busy")) patch.status = "busy";
    if (!wasAnswered && call.direction === "inbound" && call.status !== "voicemail") {
      const meta = (call.metadata as Record<string, unknown>) || {};
      const orch = (meta.orchestration as Record<string, unknown>) || {};
      const orchStage = String(orch.stage || "");
      const stillOrchestrated =
        orchStage === "ai_active" || orchStage === "phone_forwarding_after_ai";
      if (!stillOrchestrated) {
        patch.status = "missed";
        patch.disposition = call.disposition || `missed:${hangupCause || "no_answer"}`;
        patch.callbackNeeded = true;
        patch.endedAt = new Date();
      }
    }
    if (call.direction === "outbound" && patch.status === "completed") {
      patch.endedAt = patch.endedAt || new Date();
      if (!wasAnswered && !call.answeredAt) {
        patch.status = "missed";
        patch.disposition = call.disposition || `missed:${hangupCause || "no_answer"}`;
      }
    }
  }

  const updated = await prisma.humanCall.update({
    where: { id: call.id },
    data: patch,
  });

  const becameMissedInbound =
    input.eventType === "call.hangup" &&
    call.direction === "inbound" &&
    !wasAnswered &&
    (patch.status === "missed" || updated.status === "missed");
  if (becameMissedInbound && updated.phoneNumberId) {
    const { schedulePhoneOwnedMctbIfMissed } = await import("@/lib/server/mctb/pipeline");
    schedulePhoneOwnedMctbIfMissed({ workspaceId: call.workspaceId, humanCallId: call.id });
  }

  void import("@/lib/server/mctb/recovery-scheduler").then(({ processDueMctbRecoverySends }) =>
    processDueMctbRecoverySends({ workspaceId: call.workspaceId }).catch(() => undefined),
  );

  await prisma.humanCallEvent.create({
    data: {
      workspaceId: call.workspaceId,
      humanCallId: call.id,
      eventType: input.eventType,
      payload: input.eventPayload as import("@prisma/client").Prisma.InputJsonValue,
    },
  });

  const attemptId = (call.metadata as { powerDialerAttemptId?: string } | null)?.powerDialerAttemptId;
  if (attemptId && input.eventType === "call.hangup") {
    await prisma.powerDialerAttempt.updateMany({
      where: { id: attemptId },
      data: { status: "completed", endedAt: new Date() },
    });
  }

  return { ok: true, call: updated };
}
