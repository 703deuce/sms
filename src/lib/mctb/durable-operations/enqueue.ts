import "server-only";

import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { JOB_PRIORITY_VOICE_CONSEQUENTIAL } from "@/lib/jobs/job-priority";
import { MCTB_DURABLE_OPERATION_JOB, MCTB_DURABLE_OPERATION_MAX_ATTEMPTS } from "./constants";

export async function enqueueMctbDurableOperationJob(input: {
  workspaceId: string;
  operationId: string;
  wake?: boolean;
  runAfter?: Date;
}) {
  if (process.env.MCTB_DURABLE_OP_CERT === "1") {
    return { id: `cert-job-${input.operationId}`, jobType: MCTB_DURABLE_OPERATION_JOB };
  }
  const idempotencyKey = `mctb-durable-op:${input.operationId}`;
  return enqueueJob({
    workspaceId: input.workspaceId,
    jobType: MCTB_DURABLE_OPERATION_JOB,
    queueName: "voice-calls",
    priority: JOB_PRIORITY_VOICE_CONSEQUENTIAL,
    maxAttempts: MCTB_DURABLE_OPERATION_MAX_ATTEMPTS,
    idempotencyKey,
    runAfter: input.runAfter,
    wake: input.wake ?? true,
    payload: {
      workspaceId: input.workspaceId,
      operationId: input.operationId,
      enqueuedAt: new Date().toISOString(),
    },
  });
}
