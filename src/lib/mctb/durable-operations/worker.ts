import "server-only";

import { JobDeferredError } from "@/lib/messaging/types";
import {
  MCTB_DURABLE_OPERATION_LEASE_MS,
  MCTB_DURABLE_OPERATION_MAX_ATTEMPTS,
} from "./constants";
import { appendTraceEvent } from "./trace";
import { classifyErrorForRetry, computeRetryBackoffMs } from "./retry-policy";
import { getMctbDurableOperationStore } from "./store";
import { enqueueMctbDurableOperationJob } from "./enqueue";
import { processVoiceAiBookingTurnOperation } from "./processors/voice-ai-booking-turn";

export async function claimMctbDurableOperation(operationId: string) {
  const store = getMctbDurableOperationStore();
  const row = await store.findById(operationId);
  if (!row) throw new Error(`mctb_durable_operation_not_found:${operationId}`);

  const now = new Date();
  const leaseExpired =
    !row.claimLeaseExpiresAt || Date.parse(row.claimLeaseExpiresAt) <= now.getTime();
  const reclaimable =
    row.status === "PENDING" ||
    row.status === "FAILED_RETRYABLE" ||
    ((row.status === "CLAIMED" || row.status === "PROCESSING" || row.status === "WAITING_PROVIDER") &&
      leaseExpired);

  if (!reclaimable) {
    if (row.status === "SUCCEEDED" || row.status === "FAILED_TERMINAL" || row.status === "CANCELLED") {
      return { claimed: false, operation: row, reason: "already_terminal" as const };
    }
    return { claimed: false, operation: row, reason: "lease_active" as const };
  }

  const attemptCount = row.attemptCount + 1;
  const claimLeaseExpiresAt = new Date(now.getTime() + MCTB_DURABLE_OPERATION_LEASE_MS);
  const updated = await store.update(operationId, {
    status: "CLAIMED",
    attemptCount,
    claimedAt: now,
    claimLeaseExpiresAt,
    lastAttemptAt: now,
    nextAttemptAt: null,
    traceJson: appendTraceEvent(row.traceJson, "CLAIMED", { attemptCount }),
  });
  return { claimed: true, operation: updated, reason: "claimed" as const };
}

async function runProcessor(operation: import("./types").MctbDurableOperationRecord) {
  switch (operation.operationType) {
    case "VOICE_AI_BOOKING_TURN":
      return processVoiceAiBookingTurnOperation(operation);
    default:
      throw new Error(`unsupported_mctb_durable_operation:${operation.operationType}`);
  }
}

export async function executeMctbDurableOperationJob(payload: Record<string, unknown>) {
  const operationId = String(payload.operationId || "");
  const workspaceId = String(payload.workspaceId || "");
  if (!operationId || !workspaceId) {
    throw new Error("mctb_durable_operation_payload_incomplete");
  }

  const claim = await claimMctbDurableOperation(operationId);
  if (!claim.claimed) {
    if (claim.reason === "already_terminal") {
      return { ok: true, skipped: true, status: claim.operation.status };
    }
    throw new JobDeferredError(`mctb_durable_operation_lease_active:${operationId}`, 5_000, true);
  }

  const store = getMctbDurableOperationStore();
  let operation = claim.operation;
  await store.update(operationId, {
    status: "PROCESSING",
    traceJson: appendTraceEvent(operation.traceJson, "PROCESSING"),
  });
  operation = (await store.findById(operationId))!;

  try {
    const resultJson = await runProcessor(operation);
    const completed = await store.update(operationId, {
      status: "SUCCEEDED",
      resultJson,
      completedAt: new Date(),
      claimLeaseExpiresAt: null,
      failureClass: null,
      failureDetail: null,
      traceJson: appendTraceEvent(operation.traceJson, "SUCCEEDED"),
    });
    return { ok: true, operationId, status: completed.status, result: resultJson };
  } catch (err) {
    const classified = classifyErrorForRetry(err);
    const terminal = !classified.retryable || operation.attemptCount >= MCTB_DURABLE_OPERATION_MAX_ATTEMPTS;
    const status = terminal ? "FAILED_TERMINAL" : "FAILED_RETRYABLE";
    const nextAttemptAt = terminal
      ? null
      : new Date(Date.now() + computeRetryBackoffMs(operation.attemptCount));

    await store.update(operationId, {
      status,
      failureClass: classified.failureClass,
      failureDetail: classified.message,
      claimLeaseExpiresAt: null,
      nextAttemptAt,
      completedAt: terminal ? new Date() : null,
      traceJson: appendTraceEvent(operation.traceJson, status, {
        failureClass: classified.failureClass,
        attempt: operation.attemptCount,
      }),
    });

    if (!terminal && nextAttemptAt) {
      await enqueueMctbDurableOperationJob({
        workspaceId,
        operationId,
        runAfter: nextAttemptAt,
      });
      throw new JobDeferredError(
        `mctb_durable_operation_retry:${classified.failureClass}`,
        Math.max(1_000, nextAttemptAt.getTime() - Date.now()),
        true,
      );
    }

    return {
      ok: false,
      operationId,
      status,
      failureClass: classified.failureClass,
      error: classified.message,
    };
  }
}
