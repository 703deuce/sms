import "server-only";

import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { JOB_PRIORITY_VOICE_CONSEQUENTIAL } from "@/lib/jobs/job-priority";
import {
  VOICE_HOLD_LADDER_PHRASES,
  VOICE_HOLD_LADDER_TIER_MS,
  VOICE_OPERATION_MAX_MS,
} from "@/lib/voice/ai-booking/durable-operation-constants";
import { getMctbDurableOperationStore } from "@/lib/mctb/durable-operations/store";
import type { MctbDurableOperationRecord } from "@/lib/mctb/durable-operations/types";

export type VoiceDurableOpDeliveryStatus =
  | "PENDING"
  | "HTTP_TOOL_ACKED"
  | "HTTP_DELIVERY_TIMEOUT"
  | "DELIVERED"
  | "OPERATION_EXPIRED";

export type VoiceDurableOpRuntimeState = {
  operationId: string;
  startedAt: string;
  holdTierEmitted: number;
  deliveryStatus: VoiceDurableOpDeliveryStatus;
  telnyxConversationId?: string | null;
  toolExecutionId?: string | null;
  lastHoldSpokenAt?: string | null;
  httpAckAt?: string | null;
};

const META_KEY = "voiceDurableOpRuntime";

export async function loadVoiceDurableOpRuntime(
  callId: string,
): Promise<VoiceDurableOpRuntimeState | null> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  const meta = (call?.metadata || {}) as Record<string, unknown>;
  const raw = meta[META_KEY];
  if (!raw || typeof raw !== "object") return null;
  return raw as VoiceDurableOpRuntimeState;
}

export async function saveVoiceDurableOpRuntime(
  callId: string,
  state: VoiceDurableOpRuntimeState,
): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({
    where: { id: callId },
    select: { metadata: true },
  });
  const meta = (call?.metadata || {}) as Record<string, unknown>;
  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      metadata: {
        ...meta,
        [META_KEY]: state,
      } as object,
    },
  });
}

export async function registerVoiceDurableOperationRuntime(input: {
  callId: string;
  operationId: string;
  workspaceId: string;
  telnyxConversationId?: string | null;
  toolExecutionId?: string | null;
}) {
  const now = new Date().toISOString();
  await saveVoiceDurableOpRuntime(input.callId, {
    operationId: input.operationId,
    startedAt: now,
    holdTierEmitted: 0,
    deliveryStatus: "PENDING",
    telnyxConversationId: input.telnyxConversationId,
    toolExecutionId: input.toolExecutionId,
    httpAckAt: null,
  });
  await scheduleVoiceOperationHoldLadder({
    workspaceId: input.workspaceId,
    callId: input.callId,
    operationId: input.operationId,
  });
}

export async function markVoiceOperationHttpAck(input: {
  callId: string;
  operationId: string;
}) {
  const runtime = await loadVoiceDurableOpRuntime(input.callId);
  if (!runtime || runtime.operationId !== input.operationId) return;
  await saveVoiceDurableOpRuntime(input.callId, {
    ...runtime,
    deliveryStatus: "HTTP_TOOL_ACKED",
    httpAckAt: new Date().toISOString(),
  });
}

export function holdPhraseForTier(tier: number): string {
  const idx = Math.min(Math.max(tier, 0), VOICE_HOLD_LADDER_PHRASES.length - 1);
  return VOICE_HOLD_LADDER_PHRASES[idx];
}

export function runtimeHoldTierForElapsed(elapsedMs: number): number {
  if (elapsedMs >= VOICE_HOLD_LADDER_TIER_MS[2]) return 2;
  if (elapsedMs >= VOICE_HOLD_LADDER_TIER_MS[1]) return 1;
  return 0;
}

export async function getActiveVoiceOperationForCall(
  callId: string,
): Promise<MctbDurableOperationRecord | null> {
  const runtime = await loadVoiceDurableOpRuntime(callId);
  if (!runtime?.operationId) return null;
  const store = getMctbDurableOperationStore();
  return store.findById(runtime.operationId);
}

export function isOperationInFlight(status: string): boolean {
  return (
    status === "PENDING" ||
    status === "CLAIMED" ||
    status === "PROCESSING" ||
    status === "WAITING_PROVIDER" ||
    status === "FAILED_RETRYABLE"
  );
}

export async function scheduleVoiceOperationHoldLadder(input: {
  workspaceId: string;
  callId: string;
  operationId: string;
}) {
  for (let tier = 1; tier < VOICE_HOLD_LADDER_TIER_MS.length; tier++) {
    const delayMs = VOICE_HOLD_LADDER_TIER_MS[tier];
    await enqueueJob({
      workspaceId: input.workspaceId,
      jobType: "mctb_voice_operation_hold_tick",
      queueName: "voice-calls",
      priority: JOB_PRIORITY_VOICE_CONSEQUENTIAL,
      idempotencyKey: `voice-hold:${input.operationId}:t${tier}`,
      runAfter: new Date(Date.now() + delayMs),
      payload: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        operationId: input.operationId,
        tier,
      },
    });
  }
  await enqueueJob({
    workspaceId: input.workspaceId,
    jobType: "mctb_voice_operation_expire_check",
    queueName: "voice-calls",
    priority: JOB_PRIORITY_VOICE_CONSEQUENTIAL,
    idempotencyKey: `voice-op-expire:${input.operationId}`,
    runAfter: new Date(Date.now() + VOICE_OPERATION_MAX_MS),
    payload: {
      workspaceId: input.workspaceId,
      callId: input.callId,
      operationId: input.operationId,
    },
  });
}

export async function operationElapsedMs(operation: MctbDurableOperationRecord): Promise<number> {
  const start = Date.parse(operation.createdAt);
  return Date.now() - start;
}
