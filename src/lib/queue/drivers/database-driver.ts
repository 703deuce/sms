import type { EnqueueJobResult, QueueDriverName } from "@/lib/queue/types";
import {
  createLedgerJob,
  findJobByIdempotencyKey,
  markLedgerEnqueued,
} from "@/lib/queue/ledger";
import type { EnqueueJobInput } from "@/lib/queue/types";
import { canReuseExistingJob } from "@/lib/queue/idempotency";

/**
 * Database driver: Postgres job_queue is both ledger and execution source.
 * Coolify cron (`/api/jobs/process`) claims pending rows.
 * Interactive Maps also keep the Next.js `after()` kick for low-latency starts.
 */
export async function databaseEnqueue(
  input: EnqueueJobInput
): Promise<EnqueueJobResult> {
  if (input.idempotencyKey) {
    const existing = await findJobByIdempotencyKey(input.idempotencyKey);
    if (existing && canReuseExistingJob(existing)) {
      return {
        jobId: existing.id,
        queueName: input.queueName,
        driver: "database",
        enqueueState: existing.enqueueState,
        reused: true,
        status: existing.status,
      };
    }
  }

  const row = await createLedgerJob(input);

  if (canReuseExistingJob(row)) {
    return {
      jobId: row.id,
      queueName: input.queueName,
      driver: "database" satisfies QueueDriverName,
      enqueueState: row.enqueueState,
      reused: true,
      status: row.status,
    };
  }
  if (row.status !== "pending") {
    return {
      jobId: row.id,
      queueName: input.queueName,
      driver: "database",
      enqueueState: "enqueue_failed",
      reused: false,
      status: row.status,
    };
  }

  await markLedgerEnqueued(row.id, { queueJobId: row.id, enqueueState: "enqueued" });

  return {
    jobId: row.id,
    queueName: input.queueName,
    driver: "database" satisfies QueueDriverName,
    enqueueState: "enqueued",
    reused: false,
    status: row.status,
  };
}
