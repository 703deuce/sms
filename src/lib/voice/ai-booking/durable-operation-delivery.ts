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
import { voiceBookingResponseFromDurableOperation } from "@/lib/voice/ai-booking/tool-result-contract";
import { terminalFailureSpeak } from "@/lib/mctb/durable-operations/holding";

export async function buildAuthoritativeToolPayload(
  operation: MctbDurableOperationRecord,
): Promise<Record<string, unknown>> {
  return voiceBookingResponseFromDurableOperation(operation);
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

  const deliveryClaimedAt = Date.now();
  const payload = await buildAuthoritativeToolPayload(input.operation);
  const deliveryEnqueuedAt = (
    input.operation.resultJson?.delivery as Record<string, unknown> | undefined
  )?.operationSucceededAt;
  const toolJson = JSON.stringify({
    ...payload,
    runtime_injected: true,
    operation_id: input.operation.id,
    voice_result_consumed: true,
  }).slice(0, 4000);

  const telnyxDeliverySentAt = Date.now();
  await addConversationMessage(conversationId, {
    role: "tool",
    content: toolJson,
  });
  const telnyxDeliveryAcceptedAt = Date.now();

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

  const deliveryQueueMs =
    deliveryEnqueuedAt != null
      ? Math.max(0, deliveryClaimedAt - Date.parse(String(deliveryEnqueuedAt)))
      : null;
  const deliveryHttpMs = telnyxDeliveryAcceptedAt - telnyxDeliverySentAt;

  await appendOperationTrace(input.operation.id, "VOICE_RESULT_CONSUMED", {
    conversationId,
    voice_booking_status: status,
    ok: payload.ok,
    PROVIDER_COMPLETE_AT: deliveryEnqueuedAt,
    DELIVERY_CLAIMED_AT: new Date(deliveryClaimedAt).toISOString(),
    TELNYX_DELIVERY_SENT_AT: new Date(telnyxDeliverySentAt).toISOString(),
    TELNYX_DELIVERY_ACCEPTED_AT: new Date(telnyxDeliveryAcceptedAt).toISOString(),
    DELIVERY_QUEUE_MS: deliveryQueueMs,
    DELIVERY_HTTP_MS: deliveryHttpMs,
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
