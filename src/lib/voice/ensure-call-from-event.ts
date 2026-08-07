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

  const call = await prisma.voiceCall.create({
    data: {
      workspaceId,
      agentId,
      agentVersionId,
      contactId,
      direction: "INBOUND",
      status: /ended|hangup|completed/i.test(input.eventType)
        ? "COMPLETED"
        : "IN_PROGRESS",
      fromE164,
      toE164,
      phoneNumberId,
      telnyxCallControlId: controlId || null,
      telnyxConversationId: conversationId || null,
      answeredAt: new Date(),
      metadata: {
        source: "texml_or_assistant_event",
        eventType: input.eventType,
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
