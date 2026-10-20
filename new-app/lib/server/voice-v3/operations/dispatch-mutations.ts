import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceV3OperationStatus, VoiceV3OperationType } from "./types";
import { startOperation, transitionOperation } from "./registry";

export function beginMutatingOperation(
  ctx: VoiceV3CallContext,
  input: {
    operationId: string;
    type: VoiceV3OperationType;
    schedulingGeneration?: number;
    goalId?: string;
  },
): VoiceV3CallContext {
  const existing = ctx.operations?.[input.operationId];
  if (existing && (existing.status === "RUNNING" || existing.status === "PENDING")) {
    return ctx;
  }
  return startOperation(ctx, {
    operationId: input.operationId,
    type: input.type,
    schedulingGeneration: input.schedulingGeneration,
    goalId: input.goalId,
  });
}

export function finishMutatingOperation(
  ctx: VoiceV3CallContext,
  operationId: string,
  status: Exclude<VoiceV3OperationStatus, "PENDING" | "RUNNING">,
  failureCode?: string,
): VoiceV3CallContext {
  if (!ctx.operations?.[operationId]) return ctx;
  return transitionOperation(ctx, operationId, status, { failureCode });
}
