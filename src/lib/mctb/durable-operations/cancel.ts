import "server-only";

import { getMctbDurableOperationStore } from "./store";
import { appendTraceEvent } from "./trace";

export async function cancelMctbDurableOperation(input: {
  workspaceId: string;
  operationId: string;
  reason?: string;
}) {
  const store = getMctbDurableOperationStore();
  const row = await store.findById(input.operationId);
  if (!row || row.workspaceId !== input.workspaceId) {
    return { ok: false, reason: "not_found" };
  }
  if (row.status === "SUCCEEDED") {
    return { ok: false, reason: "already_succeeded", operation: row };
  }
  const updated = await store.update(input.operationId, {
    status: "CANCELLED",
    completedAt: new Date(),
    failureClass: "STALE_ACTION",
    failureDetail: input.reason || "customer_cancelled",
    traceJson: appendTraceEvent(row.traceJson, "CANCELLED", { reason: input.reason }),
  });
  return { ok: true, operation: updated };
}
