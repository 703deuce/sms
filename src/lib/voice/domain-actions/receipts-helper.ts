import { recordOperationReceipt } from "@/lib/voice/workflow-engine/receipts";
import type { OperationReceipt } from "@/lib/voice/workflow-engine/types";

export async function writeToolReceipt(input: {
  callId: string;
  operationId: string;
  type: string;
  status: OperationReceipt["status"];
  provider?: string | null;
  providerReference?: string | null;
  errorCode?: string | null;
  latencyMs?: number;
}): Promise<void> {
  await recordOperationReceipt(input.callId, {
    operation_id: input.operationId,
    type: input.type,
    status: input.status,
    provider: input.provider ?? null,
    provider_reference: input.providerReference ?? null,
    error_code: input.errorCode ?? null,
    latency_ms: input.latencyMs ?? null,
  }).catch(() => undefined);
}
