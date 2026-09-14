import "server-only";

import { getPrisma } from "@/lib/db";
import { recordMctbBookingAuditEvent } from "@/lib/mctb/ai-booking/booking-audit";

export async function persistVoiceAiBookingOperationAudit(input: {
  workspaceId: string;
  conversationId: string;
  callId?: string | null;
  voiceAgentId?: string | null;
  toolExecutionId?: string | null;
  operationId?: string | null;
  microsoftConnectionId?: string | null;
  targetCalendarId?: string | null;
  utterance?: string | null;
  phase: string;
  offeredSlotIds?: string[];
  spokenSlotLabels?: string[];
  selectedSlotId?: string | null;
  providerStartUtc?: string | null;
  providerEndUtc?: string | null;
  businessTimezone?: string | null;
  providerBookingId?: string | null;
  toolLatencyMs?: number | null;
  spokenResult?: string | null;
  status?: string | null;
  extra?: Record<string, unknown>;
}) {
  const payload = {
    channel: "voice",
    phase: input.phase,
    callId: input.callId ?? null,
    voiceAgentId: input.voiceAgentId ?? null,
    toolExecutionId: input.toolExecutionId ?? null,
    operationId: input.operationId ?? null,
    microsoftConnectionId: input.microsoftConnectionId ?? null,
    targetCalendarId: input.targetCalendarId ?? null,
    utterance: input.utterance ?? null,
    offeredSlotIds: input.offeredSlotIds ?? [],
    spokenSlotLabels: input.spokenSlotLabels ?? [],
    selectedSlotId: input.selectedSlotId ?? null,
    providerStartUtc: input.providerStartUtc ?? null,
    providerEndUtc: input.providerEndUtc ?? null,
    businessTimezone: input.businessTimezone ?? null,
    providerBookingId: input.providerBookingId ?? null,
    toolLatencyMs: input.toolLatencyMs ?? null,
    spokenResult: input.spokenResult ?? null,
    status: input.status ?? null,
    ...(input.extra || {}),
  };

  await recordMctbBookingAuditEvent({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    kind: "VOICE_AI_BOOKING_OPERATION",
    payload,
  });

  if (process.env.MCTB_DURABLE_OP_CERT === "1") {
    return;
  }
  const prisma = getPrisma();
  if (input.callId) {
    const call = await prisma.voiceCall.findFirst({
      where: { id: input.callId, workspaceId: input.workspaceId },
      select: { metadata: true },
    });
    const meta = (call?.metadata || {}) as Record<string, unknown>;
    const prev = Array.isArray(meta.voiceAiBookingOperations)
      ? (meta.voiceAiBookingOperations as unknown[])
      : [];
    const next = [...prev, { at: new Date().toISOString(), ...payload }].slice(-40);
    await prisma.voiceCall
      .update({
        where: { id: input.callId },
        data: {
          metadata: {
            ...meta,
            voiceAiBookingOperations: next,
            lastVoiceAiBookingOperation: payload,
          } as object,
        },
      })
      .catch(() => undefined);
  }
}
