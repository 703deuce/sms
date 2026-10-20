import type { VoiceV3CallContext } from "../state/call-context";
import type {
  VoiceV3Operation,
  VoiceV3OperationStatus,
  VoiceV3OperationType,
  VoiceV3OperationsMap,
} from "./types";

function bump(ctx: VoiceV3CallContext): VoiceV3CallContext {
  return { ...ctx, runtime: { version: ctx.runtime.version + 1 }, updatedAt: new Date().toISOString() };
}

export function getOperations(ctx: VoiceV3CallContext): VoiceV3OperationsMap {
  return ctx.operations ?? {};
}

export function listActiveOperations(ctx: VoiceV3CallContext): VoiceV3Operation[] {
  return Object.values(getOperations(ctx)).filter(
    (o) => o.status === "RUNNING" || o.status === "PENDING" || o.status === "OUTCOME_UNKNOWN",
  );
}

export function findOperationByType(
  ctx: VoiceV3CallContext,
  type: VoiceV3OperationType,
  status?: VoiceV3OperationStatus,
): VoiceV3Operation | undefined {
  return Object.values(getOperations(ctx)).find(
    (o) => o.type === type && (status == null || o.status === status),
  );
}

export function startOperation(
  ctx: VoiceV3CallContext,
  input: {
    operationId: string;
    type: VoiceV3OperationType;
    goalId?: string;
    schedulingGeneration?: number;
    attempt?: number;
    at?: Date;
  },
): VoiceV3CallContext {
  const at = (input.at ?? new Date()).toISOString();
  const op: VoiceV3Operation = {
    operationId: input.operationId,
    type: input.type,
    status: "RUNNING",
    goalId: input.goalId,
    stateVersionAtStart: ctx.runtime.version,
    schedulingGeneration: input.schedulingGeneration,
    attempt: input.attempt ?? 1,
    startedAt: at,
  };
  const operations = { ...getOperations(ctx), [op.operationId]: op };
  console.log("ASYNC_ACTION_STARTED", {
    call_id: ctx.callId,
    operation_id: op.operationId,
    operation_type: op.type,
    state_version: ctx.runtime.version,
    scheduling_generation: op.schedulingGeneration ?? null,
  });
  return bump({ ...ctx, operations });
}

export function transitionOperation(
  ctx: VoiceV3CallContext,
  operationId: string,
  status: VoiceV3OperationStatus,
  patch?: Partial<Pick<VoiceV3Operation, "failureCode" | "finishedAt">>,
): VoiceV3CallContext {
  const operations = { ...getOperations(ctx) };
  const existing = operations[operationId];
  if (!existing) return ctx;
  if (
    existing.status === "SUCCEEDED" ||
    existing.status === "FAILED" ||
    existing.status === "STALE" ||
    existing.status === "CANCELLED"
  ) {
    return ctx;
  }
  const finishedAt = patch?.finishedAt ?? new Date().toISOString();
  operations[operationId] = {
    ...existing,
    status,
    finishedAt,
    failureCode: patch?.failureCode ?? existing.failureCode,
  };
  const event =
    status === "SUCCEEDED"
      ? "ASYNC_ACTION_SUCCEEDED"
      : status === "FAILED" || status === "TIMED_OUT"
        ? "ASYNC_ACTION_FAILED"
        : status === "STALE"
          ? "ASYNC_ACTION_STALE"
          : status === "OUTCOME_UNKNOWN"
            ? "ASYNC_ACTION_OUTCOME_UNKNOWN"
            : "ASYNC_ACTION_UPDATED";
  console.log(event, {
    call_id: ctx.callId,
    operation_id: operationId,
    operation_type: existing.type,
    status,
    failure_code: patch?.failureCode ?? null,
  });
  return bump({ ...ctx, operations });
}

export function markOperationsStaleForScheduling(
  ctx: VoiceV3CallContext,
  currentGeneration: number,
): VoiceV3CallContext {
  let next = ctx;
  for (const op of Object.values(getOperations(ctx))) {
    if (
      op.schedulingGeneration != null &&
      op.schedulingGeneration !== currentGeneration &&
      (op.status === "RUNNING" || op.status === "PENDING")
    ) {
      next = transitionOperation(next, op.operationId, "STALE");
    }
  }
  return next;
}

export function cancelRunningOperationsForGoal(
  ctx: VoiceV3CallContext,
  goalId: string,
): VoiceV3CallContext {
  let next = ctx;
  for (const op of Object.values(getOperations(ctx))) {
    if (op.goalId === goalId && op.status === "RUNNING") {
      next = transitionOperation(next, op.operationId, "CANCELLED");
    }
  }
  return next;
}
