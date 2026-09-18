/**
 * Ensure a VoiceCall (+ workflow enrollment) exists for Telnyx events.
 *
 * TeXML-direct routing may not always emit Call Control `call.initiated`
 * before assistant conversation events. Without a VoiceCall row, executions
 * never start and post-call resume has nothing to bind.
 */

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { resolveInboundPhoneRowByE164 } from "@/lib/phone/resolve-inbound-e164";
import { backfillCallAni } from "@/lib/voice/call-identity";

function pickString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function parseEventTimes(p: Record<string, unknown>): {
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
} {
  const startRaw = pickString(p.StartTime, p.start_time, p.started_at);
  const endRaw = pickString(p.EndTime, p.OccurredAt, p.Timestamp, p.ended_at);
  const durationRaw = pickString(p.CallDuration, p.call_duration, p.Duration);
  const durationSeconds = durationRaw ? Number(durationRaw) || undefined : undefined;

  let startedAt: Date | undefined;
  let endedAt: Date | undefined;

  if (startRaw) {
    const d = new Date(startRaw);
    if (!Number.isNaN(d.getTime())) startedAt = d;
  }
  if (endRaw) {
    const d = new Date(endRaw);
    if (!Number.isNaN(d.getTime())) endedAt = d;
  }
  if (!startedAt && endedAt && durationSeconds) {
    startedAt = new Date(endedAt.getTime() - durationSeconds * 1000);
  }

  // Do not parse AnsweredTime here — Telnyx TeXML echoes StartTime on ring-outs.
  return { startedAt, endedAt, durationSeconds };
}

async function backfillCallTiming(
  callId: string,
  times: ReturnType<typeof parseEventTimes>,
): Promise<void> {
  if (!times.startedAt && !times.endedAt && times.durationSeconds == null) return;
  const prisma = getPrisma();
  const existing = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { startedAt: true, endedAt: true, durationSeconds: true },
  });
  if (!existing) return;

  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      ...(times.startedAt &&
      (!existing.startedAt || times.startedAt < existing.startedAt)
        ? { startedAt: times.startedAt }
        : {}),
      ...(times.endedAt ? { endedAt: times.endedAt } : {}),
      ...(times.durationSeconds != null ? { durationSeconds: times.durationSeconds } : {}),
    },
  });
}

function isTerminalEventType(eventType: string): boolean {
  return /ended|hangup|completed/i.test(eventType);
}

function isAnsweredEventType(eventType: string): boolean {
  return (
    eventType === "call.answered" ||
    eventType === "call.conversation.created" ||
    eventType === "conversation.created" ||
    eventType === "conversation.started"
  );
}

function initialCallStatus(input: {
  eventType: string;
  terminal: boolean;
  texmlStatus: string;
}): string {
  const texml = input.texmlStatus.toLowerCase().replace(/_/g, "-");
  if (input.terminal) {
    if (texml.includes("busy")) return "BUSY";
    if (texml === "failed") return "FAILED";
    if (texml === "canceled" || texml === "cancelled") return "CANCELLED";
    if (texml === "no-answer" || texml === "noanswer") return "NO_ANSWER";
    return "COMPLETED";
  }
  if (
    isAnsweredEventType(input.eventType) ||
    texml === "answered" ||
    texml === "in-progress" ||
    texml === "inprogress"
  ) {
    return "IN_PROGRESS";
  }
  return "RINGING";
}

async function resolveInboundPhoneForWorkspace(input: {
  workspaceId: string;
  e164: string;
  agentId?: string | null;
}) {
  const prisma = getPrisma();
  const e164 = normalizeE164(input.e164) || input.e164;

  if (input.agentId) {
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: input.agentId, workspaceId: input.workspaceId },
      select: { phoneNumberId: true },
    });
    if (agent?.phoneNumberId) {
      const byAgentPhone = await prisma.phoneNumber.findFirst({
        where: { id: agent.phoneNumberId, workspaceId: input.workspaceId },
        select: { id: true, workspaceId: true, e164: true },
      });
      if (byAgentPhone) return byAgentPhone;
    }
  }

  const byWs = await prisma.phoneNumber.findFirst({
    where: { workspaceId: input.workspaceId, e164 },
    orderBy: { purchasedAt: "desc" },
    select: { id: true, workspaceId: true, e164: true },
  });
  if (byWs) return byWs;

  try {
    const { loadMctbLineInboundConfig } = await import("@/lib/mctb/inbound-handling/line-config");
    const line = await loadMctbLineInboundConfig({ workspaceId: input.workspaceId });
    if (line?.ingressE164 === e164 && line.phoneNumberId) {
      return prisma.phoneNumber.findFirst({
        where: { id: line.phoneNumberId, workspaceId: input.workspaceId },
        select: { id: true, workspaceId: true, e164: true },
      });
    }
  } catch {
    // optional
  }

  return null;
}

export async function ensureVoiceCallForTelnyxEvent(input: {
  eventType: string;
  eventPayload: Record<string, unknown>;
  /** Tool webhooks / ingress handlers pin workspace to avoid duplicate-e164 collisions. */
  expectedWorkspaceId?: string | null;
  expectedAgentId?: string | null;
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
  const times = parseEventTimes(p);

  const expectedWorkspaceId = input.expectedWorkspaceId?.trim() || null;

  if (controlId) {
    const byControl = await prisma.voiceCall.findFirst({
      where: {
        telnyxCallControlId: controlId,
        ...(expectedWorkspaceId ? { workspaceId: expectedWorkspaceId } : {}),
      },
      select: { id: true, workspaceId: true, fromE164: true, status: true, endedAt: true },
    });
    if (
      byControl &&
      (!expectedWorkspaceId || byControl.workspaceId === expectedWorkspaceId)
    ) {
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
      where: {
        telnyxConversationId: conversationId,
        ...(expectedWorkspaceId ? { workspaceId: expectedWorkspaceId } : {}),
      },
      orderBy: { startedAt: "desc" },
      select: { id: true, workspaceId: true, fromE164: true, status: true, endedAt: true },
    });
    if (byConv && (!expectedWorkspaceId || byConv.workspaceId === expectedWorkspaceId)) {
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

  const expectedAgentId = input.expectedAgentId?.trim() || null;

  if (expectedWorkspaceId && to) {
    const pn = await resolveInboundPhoneForWorkspace({
      workspaceId: expectedWorkspaceId,
      e164: to,
      agentId: expectedAgentId,
    });
    if (pn) {
      workspaceId = pn.workspaceId;
      phoneNumberId = pn.id;
      if (expectedAgentId) {
        agentId = expectedAgentId;
        const agent = await prisma.voiceAgent.findFirst({
          where: { id: expectedAgentId, workspaceId: expectedWorkspaceId },
          select: { publishedVersionId: true },
        });
        agentVersionId = agent?.publishedVersionId || null;
      } else {
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
    } else {
      workspaceId = expectedWorkspaceId;
      if (expectedAgentId) {
        agentId = expectedAgentId;
        const agent = await prisma.voiceAgent.findFirst({
          where: { id: expectedAgentId, workspaceId: expectedWorkspaceId },
          select: { publishedVersionId: true, phoneNumberId: true },
        });
        agentVersionId = agent?.publishedVersionId || null;
        phoneNumberId = agent?.phoneNumberId || null;
      }
    }
  } else if (to) {
    const pn = await resolveInboundPhoneRowByE164(to);
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
      where: {
        telnyxAssistantId: assistantId,
        ...(expectedWorkspaceId ? { workspaceId: expectedWorkspaceId } : {}),
      },
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
  let voiceConfigFingerprint: Record<string, unknown> | null = null;
  if (agentVersionId) {
    const { buildVoiceConfigFingerprintForVersion } = await import(
      "@/lib/voice/config-fingerprint"
    );
    const fp = await buildVoiceConfigFingerprintForVersion({
      agentVersionId,
      runtimeProvider: "telnyx",
    });
    if (fp) voiceConfigFingerprint = fp as unknown as Record<string, unknown>;
    const ver = await prisma.voiceAgentVersion.findFirst({
      where: { id: agentVersionId, workspaceId },
      select: { config: true },
    });
    if (ver?.config) {
      const { parseVoiceAgentConfig } = await import("@/lib/voice/types");
      const { buildVoiceV2CallCapabilitySnapshot } = await import(
        "@/lib/voice-receptionist-wizard/workflow-capability"
      );
      voiceConfigFingerprint = {
        ...(voiceConfigFingerprint || {}),
        voiceV2Capability: buildVoiceV2CallCapabilitySnapshot(
          parseVoiceAgentConfig(ver.config),
        ),
      };
    }
  }
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
  const answeredOnCreate = isAnsweredEventType(input.eventType);
  const call = await prisma.voiceCall.create({
    data: {
      workspaceId,
      agentId,
      agentVersionId,
      contactId,
      direction: "INBOUND",
      status: initialCallStatus({
        eventType: input.eventType,
        terminal,
        texmlStatus,
      }),
      fromE164,
      toE164,
      phoneNumberId,
      telnyxCallControlId: controlId || null,
      telnyxConversationId: conversationId || null,
      startedAt: times.startedAt || (terminal ? undefined : now),
      answeredAt: answeredOnCreate ? now : null,
      endedAt: times.endedAt || (terminal ? now : undefined),
      durationSeconds: times.durationSeconds ?? undefined,
      metadata: {
        source: "texml_or_assistant_event",
        eventType: input.eventType,
        firstEventTerminal: terminal,
        payload: p,
        ...(voiceConfigFingerprint ? { voiceConfigFingerprint } : {}),
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
async function createVoiceCallForToolWebhookFallback(input: {
  workspaceId: string;
  agentId: string;
  callControlId?: string | null;
  conversationId?: string | null;
  fromE164?: string | null;
  toE164?: string | null;
}): Promise<string | null> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: {
      id: true,
      publishedVersionId: true,
      phoneNumberId: true,
      telnyxAssistantId: true,
    },
  });
  if (!agent) return null;

  let toE164 = input.toE164?.trim() || "";
  if (toE164) toE164 = normalizeE164(toE164) || toE164;

  if (!toE164 && agent.phoneNumberId) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: agent.phoneNumberId },
      select: { e164: true },
    });
    toE164 = pn?.e164 || "";
  }

  if (!toE164) {
    try {
      const { loadMctbLineInboundConfig } = await import(
        "@/lib/mctb/inbound-handling/line-config"
      );
      const line = await loadMctbLineInboundConfig({ workspaceId: input.workspaceId });
      if (line?.voiceAgentId === agent.id) {
        toE164 = line.ingressE164;
      }
    } catch {
      // optional MCTB line lookup
    }
  }

  if (!toE164) return null;

  const fromRaw = input.fromE164?.trim() || "";
  const fromE164 = fromRaw ? normalizeE164(fromRaw) || fromRaw : "unknown";
  const now = new Date();

  const created = await prisma.voiceCall
    .create({
      data: {
        workspaceId: input.workspaceId,
        agentId: agent.id,
        agentVersionId: agent.publishedVersionId,
        phoneNumberId: agent.phoneNumberId,
        direction: "INBOUND",
        status: "IN_PROGRESS",
        fromE164,
        toE164,
        telnyxCallControlId: input.callControlId?.trim() || null,
        telnyxConversationId: input.conversationId?.trim() || null,
        startedAt: now,
        answeredAt: now,
        metadata: {
          source: "telnyx_tool_webhook_fallback",
          assistantId: agent.telnyxAssistantId,
        } as object,
      },
    })
    .catch(() => null);

  return created?.id || null;
}

export async function ensureVoiceCallForToolWebhook(input: {
  workspaceId: string;
  agentId: string;
  callControlId?: string | null;
  conversationId?: string | null;
  fromE164?: string | null;
  toE164?: string | null;
  skipRealtimeSessionInit?: boolean;
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
    const { initializeRealtimeSessionForCall } = await import(
      "@/lib/voice/realtime-session/init"
    );
    if (!input.skipRealtimeSessionInit) {
      await initializeRealtimeSessionForCall({
        callId: existing.id,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        telnyxConversationId: input.conversationId,
        telnyxControlId: input.callControlId,
        fromE164: input.fromE164,
      }).catch(() => undefined);
    }
    return existing.id;
  }

  const controlId = input.callControlId?.trim() || "";
  const conversationId = input.conversationId?.trim() || "";
  if (!controlId && !conversationId) return null;

  const from = input.fromE164?.trim() || "";
  const to = input.toE164?.trim() || "";

  const agentRow = await getPrisma().voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: { telnyxAssistantId: true },
  });

  const ensured = await ensureVoiceCallForTelnyxEvent({
    eventType: "call.answered",
    expectedWorkspaceId: input.workspaceId,
    expectedAgentId: input.agentId,
    eventPayload: {
      call_control_id: controlId || undefined,
      conversation_id: conversationId || undefined,
      telnyx_conversation_id: conversationId || undefined,
      from: from || undefined,
      to: to || undefined,
      assistant_id: agentRow?.telnyxAssistantId || undefined,
      ai_assistant_id: agentRow?.telnyxAssistantId || undefined,
      direction: "incoming",
      source: "telnyx_tool_webhook_ensure",
    },
  }).catch(() => null);

  let callId = ensured?.callId || null;
  if (callId) {
    const row = await getPrisma().voiceCall.findFirst({
      where: { id: callId, workspaceId: input.workspaceId },
      select: { id: true },
    });
    if (!row) callId = null;
  }
  if (!callId) {
    callId = await createVoiceCallForToolWebhookFallback(input);
  }
  if (callId && !input.skipRealtimeSessionInit) {
    const { initializeRealtimeSessionForCall } = await import(
      "@/lib/voice/realtime-session/init"
    );
    await initializeRealtimeSessionForCall({
      callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      telnyxConversationId: conversationId || null,
      telnyxControlId: controlId || null,
      fromE164: from || null,
    }).catch(() => undefined);
  }

  return callId;
}
