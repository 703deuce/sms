import "server-only";

import { getPrisma } from "@/lib/db";
import { isTelnyxAiConfigured, addConversationMessage } from "@/lib/voice/telnyx/ai-client";
import type { MctbDurableOperationRecord } from "@/lib/mctb/durable-operations/types";
import { getMctbDurableOperationStore } from "@/lib/mctb/durable-operations/store";
import { appendOperationTrace } from "@/lib/mctb/durable-operations/store";
import {
  loadVoiceDurableOpRuntime,
  saveVoiceDurableOpRuntime,
  type VoiceDurableOpRuntimeState,
} from "@/lib/voice/ai-booking/durable-operation-runtime";
import { voiceBookingResponseFromDurableTurn } from "@/lib/voice/ai-booking/tool-result-contract";
import { terminalFailureSpeak } from "@/lib/mctb/durable-operations/holding";

export async function buildAuthoritativeToolPayload(
  operation: MctbDurableOperationRecord,
): Promise<Record<string, unknown>> {
  const voice = (operation.resultJson?.voice || operation.resultJson) as Record<string, unknown>;
  const inner = (voice || {}) as Record<string, unknown>;
  const data = (inner.data || {}) as Record<string, unknown>;
  return voiceBookingResponseFromDurableTurn({
    operationStatus: operation.status,
    speak: String(inner.speak || ""),
    operationId: operation.id,
    ok: inner.ok !== false,
    error: inner.error ? String(inner.error) : undefined,
    data,
  });
}

export async function injectVoiceOperationResultToTelnyx(input: {
  workspaceId: string;
  callId: string;
  operation: MctbDurableOperationRecord;
  conversationId?: string | null;
}): Promise<{ delivered: boolean; reason?: string }> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { telnyxConversationId: true },
  });
  const conversationId = input.conversationId || call?.telnyxConversationId;
  if (!conversationId || !isTelnyxAiConfigured()) {
    return { delivered: false, reason: "no_conversation_or_telnyx" };
  }

  const payload = await buildAuthoritativeToolPayload(input.operation);
  const toolJson = JSON.stringify({
    ...payload,
    runtime_injected: true,
    operation_id: input.operation.id,
    voice_result_consumed: true,
  }).slice(0, 4000);

  await addConversationMessage(conversationId, {
    role: "tool",
    content: toolJson,
  });

  const status = payload.voice_booking_status;
  if (status === "AVAILABILITY_FOUND" || status === "BOOKING_CONFIRMED") {
    const slots = (payload.slots as Array<{ label: string }> | undefined) || [];
    const slotSummary = slots.map((s) => s.label).filter(Boolean).join(", ");
    const systemNote =
      status === "BOOKING_CONFIRMED"
        ? `BOOKING_CONFIRMED: ${payload.speak}`
        : `AVAILABILITY_FOUND authoritative slots: ${slotSummary}. Speak these exact times to the caller and ask which works.`;
    await addConversationMessage(conversationId, {
      role: "system",
      content: systemNote,
    }).catch(() => undefined);
  }

  await appendOperationTrace(input.operation.id, "VOICE_RESULT_CONSUMED", {
    conversationId,
    voice_booking_status: status,
  });

  const runtime = await loadVoiceDurableOpRuntime(input.callId);
  if (runtime) {
    await saveVoiceDurableOpRuntime(input.callId, {
      ...runtime,
      deliveryStatus: "DELIVERED",
    });
  }

  return { delivered: true };
}

export async function deliverVoiceOperationIfReady(input: {
  workspaceId: string;
  callId: string;
  operationId: string;
}): Promise<{ delivered: boolean; operation?: MctbDurableOperationRecord }> {
  const store = getMctbDurableOperationStore();
  const operation = await store.findById(input.operationId);
  if (!operation || operation.voiceCallId !== input.callId) {
    return { delivered: false };
  }
  if (operation.status !== "SUCCEEDED") {
    return { delivered: false, operation };
  }
  const runtime = await loadVoiceDurableOpRuntime(input.callId);
  if (runtime?.deliveryStatus === "DELIVERED") {
    return { delivered: true, operation };
  }
  const result = await injectVoiceOperationResultToTelnyx({
    workspaceId: input.workspaceId,
    callId: input.callId,
    operation,
  });
  return { delivered: result.delivered, operation };
}

export async function enqueueVoiceOperationDeliveryJob(input: {
  workspaceId: string;
  callId: string;
  operationId: string;
}) {
  const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
  const { JOB_PRIORITY_VOICE_CONSEQUENTIAL } = await import("@/lib/jobs/job-priority");
  await enqueueJob({
    workspaceId: input.workspaceId,
    jobType: "mctb_voice_operation_deliver",
    queueName: "voice-calls",
    priority: JOB_PRIORITY_VOICE_CONSEQUENTIAL,
    idempotencyKey: `voice-deliver:${input.operationId}`,
    payload: {
      workspaceId: input.workspaceId,
      callId: input.callId,
      operationId: input.operationId,
    },
  });
}

export async function speakHoldTierOnCall(input: {
  workspaceId: string;
  callId: string;
  operationId: string;
  tier: number;
  phrase: string;
}): Promise<void> {
  const runtime = await loadVoiceDurableOpRuntime(input.callId);
  if (!runtime || runtime.operationId !== input.operationId) return;
  if (runtime.holdTierEmitted >= input.tier) return;

  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { telnyxConversationId: true },
  });
  if (call?.telnyxConversationId && isTelnyxAiConfigured()) {
    await addConversationMessage(call.telnyxConversationId, {
      role: "assistant",
      content: input.phrase,
    }).catch(() => undefined);
  }

  await saveVoiceDurableOpRuntime(input.callId, {
    ...runtime,
    holdTierEmitted: input.tier,
    lastHoldSpokenAt: new Date().toISOString(),
  });
}

export async function markHttpDeliveryTimeoutPreservingOperation(input: {
  callId: string;
  operationId: string;
}) {
  const runtime = await loadVoiceDurableOpRuntime(input.callId);
  if (!runtime || runtime.operationId !== input.operationId) return;
  const next: VoiceDurableOpRuntimeState = {
    ...runtime,
    deliveryStatus:
      runtime.deliveryStatus === "DELIVERED" ? "DELIVERED" : "HTTP_DELIVERY_TIMEOUT",
  };
  await saveVoiceDurableOpRuntime(input.callId, next);
  await appendOperationTrace(input.operationId, "HTTP_DELIVERY_TIMEOUT", {
    note: "Telnyx abandoned sync tool window; operation may still succeed",
  });
}

export async function expireVoiceOperationFallback(input: {
  workspaceId: string;
  callId: string;
  operationId: string;
}) {
  const store = getMctbDurableOperationStore();
  const operation = await store.findById(input.operationId);
  if (!operation) return;
  if (operation.status === "SUCCEEDED") {
    await deliverVoiceOperationIfReady({
      workspaceId: input.workspaceId,
      callId: input.callId,
      operationId: input.operationId,
    });
    return;
  }
  if (
    operation.status === "FAILED_TERMINAL" ||
    operation.status === "CANCELLED" ||
    operation.status === "EXPIRED"
  ) {
    return;
  }
  await store.update(input.operationId, {
    status: "EXPIRED",
    completedAt: new Date(),
    failureClass: "ATTEMPT_TIMED_OUT",
    failureDetail: "OPERATION_TIMEOUT voice ceiling",
  });
  const runtime = await loadVoiceDurableOpRuntime(input.callId);
  if (runtime?.operationId === input.operationId) {
    await saveVoiceDurableOpRuntime(input.callId, {
      ...runtime,
      deliveryStatus: "OPERATION_EXPIRED",
    });
    const prisma = getPrisma();
    const call = await prisma.voiceCall.findFirst({
      where: { id: input.callId },
      select: { telnyxConversationId: true },
    });
    if (call?.telnyxConversationId && isTelnyxAiConfigured()) {
      await addConversationMessage(call.telnyxConversationId, {
        role: "assistant",
        content: terminalFailureSpeak(false),
      }).catch(() => undefined);
    }
  }
}
