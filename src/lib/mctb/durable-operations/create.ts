import "server-only";

import { createHash } from "node:crypto";
import { getMctbDurableOperationStore, appendOperationTrace } from "./store";
import { enqueueMctbDurableOperationJob } from "./enqueue";
import { logMctbDurableOperationEvent } from "./observability";

export function buildVoiceOperationIdempotencyKey(input: {
  voiceCallId: string;
  operationType: string;
  utterance?: string;
  offeredSlotId?: string | null;
  confirmBooking?: boolean;
  externalInvocationId?: string | null;
}): string {
  if (input.externalInvocationId?.trim()) {
    return `voice-op:${input.voiceCallId}:${input.externalInvocationId.trim()}`;
  }
  const payload = [
    input.operationType,
    input.utterance?.trim() || "",
    input.offeredSlotId?.trim() || "",
    input.confirmBooking ? "1" : "0",
  ].join("|");
  const hash = createHash("sha256").update(payload).digest("hex").slice(0, 24);
  return `voice-op:${input.voiceCallId}:${hash}`;
}

export async function createOrResolveDurableOperation(input: {
  workspaceId: string;
  conversationId?: string | null;
  voiceCallId?: string | null;
  operationType: string;
  stateVersion?: number | null;
  idempotencyKey: string;
  inputJson: Record<string, unknown>;
}) {
  const store = getMctbDurableOperationStore();
  const existing = await store.findByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    return { operation: existing, created: false };
  }
  const operation = await store.create({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    voiceCallId: input.voiceCallId,
    operationType: input.operationType,
    stateVersion: input.stateVersion,
    idempotencyKey: input.idempotencyKey,
    inputJson: input.inputJson,
  });
  await appendOperationTrace(operation.id, "ENQUEUED");
  logMctbDurableOperationEvent("ENQUEUED", {
    operationId: operation.id,
    workspaceId: input.workspaceId,
    operationType: input.operationType,
    voiceCallId: input.voiceCallId,
    conversationId: input.conversationId,
  });
  await enqueueMctbDurableOperationJob({
    workspaceId: input.workspaceId,
    operationId: operation.id,
  });
  return { operation, created: true };
}
