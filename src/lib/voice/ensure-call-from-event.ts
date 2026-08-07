/**
 * Ensure a VoiceCall (+ workflow enrollment) exists for Telnyx events.
 *
 * TeXML-direct routing may not always emit Call Control `call.initiated`
 * before assistant conversation events. Without a VoiceCall row, executions
 * never start and post-call resume has nothing to bind.
 */

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { backfillCallAni } from "@/lib/voice/call-identity";

function pickString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function parseEventTimes(
  p: Record<string, unknown>,
  eventType: string,
): {
  startedAt?: Date;
  answeredAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
} {
  const startRaw = pickString(p.StartTime, p.start_time, p.started_at);
  const answeredRaw = pickString(p.AnsweredTime, p.answered_at);
  const endRaw = pickString(p.EndTime, p.OccurredAt, p.Timestamp, p.ended_at);
  const durationRaw = pickString(p.CallDuration, p.call_duration, p.Duration);
  const texmlStatus = pickString(p.CallStatus, p.texml_call_status, p.call_status)
    .toLowerCase()
    .replace(/_/g, "-");
  const durationSeconds = durationRaw ? Number(durationRaw) || undefined : undefined;

  let startedAt: Date | undefined;
  let answeredAt: Date | undefined;
  let endedAt: Date | undefined;

  if (startRaw) {
    const d = new Date(startRaw);
    if (!Number.isNaN(d.getTime())) startedAt = d;
  }
  if (answeredRaw) {
    const d = new Date(answeredRaw);
    if (!Number.isNaN(d.getTime())) answeredAt = d;
  }
  if (endRaw) {
    const d = new Date(endRaw);
    if (!Number.isNaN(d.getTime())) endedAt = d;
  }
  if (!startedAt && endedAt && durationSeconds) {
    startedAt = new Date(endedAt.getTime() - durationSeconds * 1000);
  }
  // Only infer answered from completed calls with meaningful duration — never from StartTime alone.
  if (
    !answeredAt &&
    (texmlStatus === "completed" || texmlStatus === "answered" || texmlStatus === "in-progress") &&
    durationSeconds != null &&
    durationSeconds > 1
  ) {
    answeredAt = startedAt;
  }

  return { startedAt, answeredAt, endedAt, durationSeconds };
}

async function backfillCallTiming(
  callId: string,
  times: ReturnType<typeof parseEventTimes>,
): Promise<void> {
  if (!times.startedAt && !times.endedAt && times.durationSeconds == null) return;
  const prisma = getPrisma();
  const existing = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { startedAt: true, answeredAt: true, endedAt: true, durationSeconds: true },
  });
  if (!existing) return;

  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      ...(times.startedAt &&
      (!existing.startedAt || times.startedAt < existing.startedAt)
        ? { startedAt: times.startedAt }
        : {}),
      ...(times.answeredAt &&
      (!existing.answeredAt || times.answeredAt < existing.answeredAt)
        ? { answeredAt: times.answeredAt }
        : {}),
      ...(times.endedAt ? { endedAt: times.endedAt } : {}),
      ...(times.durationSeconds != null ? { durationSeconds: times.durationSeconds } : {}),
    },
  });
}

function isTerminalEventType(eventType: string): boolean {
  return /ended|hangup|completed/i.test(eventType);
}

function isStartEventType(eventType: string): boolean {
  return (
    eventType === "call.initiated" ||
    eventType === "call.ringing" ||
    eventType === "call.answered" ||
    eventType === "call.conversation.created" ||
    eventType === "conversation.created" ||
    eventType === "conversation.started"
  );
}

export async function ensureVoiceCallForTelnyxEvent(input: {
  eventType: string;
  eventPayload: Record<string, unknown>;
}): Promise<{ callId: string; created: boolean; enrolled: boolean } | null> {
  const prisma = getPrisma();
  const p = input.eventPayload;

  const controlId = pickString(p.call_control_id, p.call_session_id);
  const conversationId = pickString(
    p.conversation_id,
    p.telnyx_conversation_id,
  );

  const toRaw = pickString(p.to, p.destination_number, p.called);
  const fromRaw = pickString(p.from, p.start_from, p.caller_id_number, p.caller);
  const to = toRaw ? normalizeE164(toRaw) || toRaw : "";
  const from = fromRaw ? normalizeE164(fromRaw) || fromRaw : "";
  const times = parseEventTimes(p, input.eventType);

  if (controlId) {
    const byControl = await prisma.voiceCall.findFirst({
      where: { telnyxCallControlId: controlId },
      select: { id: true, workspaceId: true, fromE164: true },
    });
    if (byControl) {
      if (from) {
        await backfillCallAni({
          callId: byControl.id,
          workspaceId: byControl.workspaceId,
          fromE164: from,
        }).catch(() => undefined);
      }
      await backfillCallTiming(byControl.id, times).catch(() => undefined);
      return { callId: byControl.id, created: false, enrolled: false };
    }
  }
  if (conversationId) {
    const byConv = await prisma.voiceCall.findFirst({
      where: { telnyxConversationId: conversationId },
      select: { id: true, workspaceId: true, fromE164: true },
    });
    if (byConv) {
      if (from) {
        await backfillCallAni({
          callId: byConv.id,
          workspaceId: byConv.workspaceId,
          fromE164: from,
        }).catch(() => undefined);
      }
      await backfillCallTiming(byConv.id, times).catch(() => undefined);
      return { callId: byConv.id, created: false, enrolled: false };
    }
  }

  const assistantId = pickString(
    p.assistant_id,
    p.ai_assistant_id,
    p.to_assistant_id,
  );

  let workspaceId: string | null = null;
  let phoneNumberId: string | null = null;
  let agentId: string | null = null;
  let agentVersionId: string | null = null;

  if (to) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { e164: to },
      select: { id: true, workspaceId: true },
    });
    if (pn) {
      workspaceId = pn.workspaceId;
      phoneNumberId = pn.id;
      const { resolveInboundAiAgent } = await import("@/lib/voice/agent-phone");
      const ai = await resolveInboundAiAgent(pn.workspaceId, pn.id);
      if (ai) {
        agentId = ai.id;
        const agent = await prisma.voiceAgent.findFirst({
          where: { id: ai.id },
          select: { publishedVersionId: true },
        });
        agentVersionId = agent?.publishedVersionId || null;
      }
    }
  }

  if (!workspaceId && assistantId) {
    const agent = await prisma.voiceAgent.findFirst({
      where: { telnyxAssistantId: assistantId },
      select: {
        id: true,
        workspaceId: true,
        phoneNumberId: true,
        publishedVersionId: true,
      },
    });
    if (agent) {
      workspaceId = agent.workspaceId;
      agentId = agent.id;
      agentVersionId = agent.publishedVersionId;
      phoneNumberId = agent.phoneNumberId;
      if (!to && agent.phoneNumberId) {
        const pn = await prisma.phoneNumber.findFirst({
          where: { id: agent.phoneNumberId },
          select: { e164: true },
        });
        if (pn?.e164 && !to) {
          // keep phoneNumberId; toE164 still required on VoiceCall
        }
      }
    }
  }

  if (!workspaceId) return null;

  let toE164 = to;
  if (!toE164 && phoneNumberId) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId },
      select: { e164: true },
    });
    toE164 = pn?.e164 || "";
  }
  if (!toE164) return null;

  const fromE164 = from || "unknown";
  let contactId: string | null = null;
  if (fromE164 && fromE164 !== "unknown") {
    const {
      ensureInboundCallerContact,
    } = await import("@/lib/automations/inbound-trigger-enroll");
    const ensured = await ensureInboundCallerContact({
      workspaceId,
      fromE164,
    }).catch(async () => {
      const existing = await prisma.contact.findUnique({
        where: { workspaceId_phone: { workspaceId, phone: fromE164 } },
        select: { id: true },
      });
      return existing ? { id: existing.id, created: false } : null;
    });
    contactId = ensured?.id || null;
  }

  const now = new Date();
  const terminal = isTerminalEventType(input.eventType);
  const texmlStatus = pickString(p.CallStatus, p.texml_call_status, p.call_status)
    .toLowerCase()
    .replace(/_/g, "-");
  const missedTerminal =
    texmlStatus === "no-answer" ||
    texmlStatus === "noanswer" ||
    texmlStatus === "busy" ||
    texmlStatus === "canceled" ||
    texmlStatus === "cancelled" ||
    texmlStatus === "failed";
  const call = await prisma.voiceCall.create({
    data: {
      workspaceId,
      agentId,
      agentVersionId,
      contactId,
      direction: "INBOUND",
      status: terminal
        ? missedTerminal
          ? texmlStatus.includes("busy")
            ? "BUSY"
            : texmlStatus === "failed"
              ? "FAILED"
              : texmlStatus === "canceled" || texmlStatus === "cancelled"
                ? "CANCELLED"
                : "NO_ANSWER"
          : "COMPLETED"
        : isStartEventType(input.eventType)
          ? "IN_PROGRESS"
          : "RINGING",
      fromE164,
      toE164,
      phoneNumberId,
      telnyxCallControlId: controlId || null,
      telnyxConversationId: conversationId || null,
      startedAt: times.startedAt || (terminal ? undefined : now),
      answeredAt: times.answeredAt ?? null,
      endedAt: times.endedAt || (terminal ? now : undefined),
      durationSeconds: times.durationSeconds ?? undefined,
      metadata: {
        source: "texml_or_assistant_event",
        eventType: input.eventType,
        firstEventTerminal: terminal,
        payload: p,
      } as object,
    },
  });

  let enrolled = false;
  if (contactId && phoneNumberId) {
    const { enrollInboundCallTriggers } = await import(
      "@/lib/automations/inbound-trigger-enroll"
    );
    const results = await enrollInboundCallTriggers({
      workspaceId,
      callId: call.id,
      phoneNumberId,
      contactId,
      agentId,
      eventType: "every_call",
    }).catch(() => []);
    enrolled = results.some((r) => r.executionId);
    if (results.length) {
      await prisma.voiceCallEvent
        .create({
          data: {
            workspaceId,
            callId: call.id,
            eventType: "inbound.workflow_enrolled",
            payload: {
              enrollments: results,
              via: "ensureVoiceCallForTelnyxEvent",
            } as object,
          },
        })
        .catch(() => undefined);
    }
  }

  return { callId: call.id, created: true, enrolled };
}

/**
 * Ensure a VoiceCall exists before any Telnyx webhook tool runs.
 *
 * TeXML-direct inbound often delivers only a terminal status_callback, so the
 * first tool invocation may arrive minutes before hangup. Without a call row,
 * get_runtime_context / record_current_field / continue_workflow all fail.
 */
export async function ensureVoiceCallForToolWebhook(input: {
  workspaceId: string;
  agentId: string;
  callControlId?: string | null;
  conversationId?: string | null;
  fromE164?: string | null;
  toE164?: string | null;
}): Promise<string | null> {
  const { findVoiceCallByTelnyxIds } = await import("@/lib/voice/call-identity");
  const existing = await findVoiceCallByTelnyxIds({
    workspaceId: input.workspaceId,
    callControlId: input.callControlId || null,
    conversationId: input.conversationId || null,
    agentId: input.agentId,
  });
  if (existing?.id) {
    const prisma = getPrisma();
    if (input.conversationId && !existing.telnyxConversationId) {
      await prisma.voiceCall
        .updateMany({
          where: { id: existing.id, telnyxConversationId: null },
          data: { telnyxConversationId: input.conversationId },
        })
        .catch(() => undefined);
    }
    if (input.fromE164) {
      const { backfillCallAni } = await import("@/lib/voice/call-identity");
      await backfillCallAni({
        callId: existing.id,
        workspaceId: input.workspaceId,
        fromE164: input.fromE164,
        agentId: input.agentId,
      }).catch(() => undefined);
    }
    return existing.id;
  }

  const controlId = input.callControlId?.trim() || "";
  const conversationId = input.conversationId?.trim() || "";
  if (!controlId && !conversationId) return null;

  const from = input.fromE164?.trim() || "";
  const to = input.toE164?.trim() || "";

  const ensured = await ensureVoiceCallForTelnyxEvent({
    eventType: "call.answered",
    eventPayload: {
      call_control_id: controlId || undefined,
      conversation_id: conversationId || undefined,
      telnyx_conversation_id: conversationId || undefined,
      from: from || undefined,
      to: to || undefined,
      direction: "incoming",
      source: "telnyx_tool_webhook_ensure",
    },
  }).catch(() => null);

  return ensured?.callId || null;
}
