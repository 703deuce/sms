import type { OperationReceipt } from "@/lib/voice/workflow-engine/types";
import { loadAgentRuntime, saveAgentRuntime } from "@/lib/voice/workflow-engine/runtime-state";

export async function recordOperationReceipt(
  callId: string,
  receipt: Omit<OperationReceipt, "created_at" | "completed_at"> & {
    created_at?: string;
    completed_at?: string | null;
  },
): Promise<OperationReceipt> {
  const runtime = await loadAgentRuntime(callId);
  if (!runtime) return receipt as OperationReceipt;
  const full: OperationReceipt = {
    ...receipt,
    created_at: receipt.created_at || new Date().toISOString(),
    completed_at: receipt.completed_at ?? (receipt.status !== "pending" ? new Date().toISOString() : null),
  };
  const withoutDup = runtime.operation_receipts.filter((r) => r.operation_id !== full.operation_id);
  await saveAgentRuntime(callId, {
    ...runtime,
    operation_receipts: [...withoutDup, full],
  });
  return full;
}

export async function getOperationReceipt(
  callId: string,
  operationId: string,
): Promise<OperationReceipt | null> {
  const runtime = await loadAgentRuntime(callId);
  return runtime?.operation_receipts.find((r) => r.operation_id === operationId) || null;
}

export async function findCompletedOperation(
  callId: string,
  type: string,
): Promise<OperationReceipt | null> {
  const runtime = await loadAgentRuntime(callId);
  if (!runtime) return null;
  return (
    [...runtime.operation_receipts]
      .reverse()
      .find((r) => r.type === type && (r.status === "confirmed" || r.status === "already_completed")) ||
    null
  );
}
