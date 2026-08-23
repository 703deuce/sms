import {
  QUEUE_CONFIGS,
  getBullmqConnectionOptions,
  getRedisUrl,
} from "@/lib/queue/config";
import {
  createLedgerJob,
  findJobByIdempotencyKey,
  markLedgerEnqueueFailed,
  markLedgerEnqueued,
} from "@/lib/queue/ledger";
import type { EnqueueJobInput, EnqueueJobResult, QueueName } from "@/lib/queue/types";
import { canReuseExistingJob } from "@/lib/queue/idempotency";
import {
  assertValidBullmqQueueName,
  resolveBullmqQueueIdentity,
} from "@/lib/queue/bullmq-names";
import { logger } from "@/lib/observability/logger";

const queues = new Map<string, import("bullmq").Queue>();

function cacheKey(name: QueueName, prefix: string): string {
  // Map key only — never passed to BullMQ as a queue name.
  return `${prefix}__${name}`;
}

async function getQueue(name: QueueName): Promise<import("bullmq").Queue> {
  assertValidBullmqQueueName(name);
  const { name: queueName, prefix } = resolveBullmqQueueIdentity(name);
  const key = cacheKey(queueName, prefix);
  const existing = queues.get(key);
  if (existing) return existing;
  const { Queue } = await import("bullmq");
  const connection = getBullmqConnectionOptions(getRedisUrl());
  const cfg = QUEUE_CONFIGS[name];
  const q = new Queue(queueName, {
    connection,
    prefix,
    defaultJobOptions: {
      attempts: cfg.maxAttempts,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });
  queues.set(key, q);
  return q;
}

export async function bullmqEnqueue(input: EnqueueJobInput): Promise<EnqueueJobResult> {
  if (input.idempotencyKey) {
    const existing = await findJobByIdempotencyKey(input.idempotencyKey);
    if (existing && canReuseExistingJob(existing)) {
      return {
        jobId: existing.id,
        queueName: input.queueName,
        driver: "bullmq",
        enqueueState: existing.enqueueState,
        reused: true,
        status: existing.status,
      };
    }
  }

  const row = await createLedgerJob(input);

  // createLedgerJob may return a live reusable row from a unique race.
  if (canReuseExistingJob(row) && row.id) {
    return {
      jobId: row.id,
      queueName: input.queueName,
      driver: "bullmq",
      enqueueState: row.enqueueState,
      reused: true,
      status: row.status,
    };
  }
  if (row.status !== "pending") {
    return {
      jobId: row.id,
      queueName: input.queueName,
      driver: "bullmq",
      enqueueState: "enqueue_failed",
      reused: false,
      status: row.status,
    };
  }

  try {
    const queue = await getQueue(input.queueName);
    const job = await queue.add(
      input.jobType,
      {
        ledgerJobId: row.id,
        jobType: input.jobType,
        ...input.payload,
        organizationId: input.organizationId ?? null,
        businessId: input.businessId ?? null,
      },
      {
        jobId: row.id,
        priority: row.priority,
        delay: input.delayMs ?? 0,
        attempts: input.maxAttempts ?? QUEUE_CONFIGS[input.queueName].maxAttempts,
      }
    );
    await markLedgerEnqueued(row.id, {
      queueJobId: String(job.id ?? row.id),
      enqueueState: "enqueued",
    });
    return {
      jobId: row.id,
      queueName: input.queueName,
      driver: "bullmq",
      enqueueState: "enqueued",
      reused: false,
      status: "pending",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "BullMQ enqueue failed";
    logger.error("bullmq_enqueue_failed", {
      jobType: input.jobType,
      queueName: input.queueName,
      jobId: row.id,
      error: message,
      redisMisconf: /MISCONF|stop-writes-on-bgsave-error/i.test(message),
    });
    await markLedgerEnqueueFailed(row.id, message);
    return {
      jobId: row.id,
      queueName: input.queueName,
      driver: "bullmq",
      enqueueState: "enqueue_failed",
      reused: false,
      status: "pending",
    };
  }
}

/** Push an existing ledger row onto BullMQ (recovery / reconnect). */
export async function bullmqRequeueLedgerJob(job: {
  id: string;
  queueName: QueueName;
  jobType: string;
  payload: Record<string, unknown>;
  organizationId: string | null;
  businessId: string | null;
  priority: number;
  maxAttempts: number;
}): Promise<void> {
  const queue = await getQueue(job.queueName);
  // Avoid jobId collisions with retained completed/failed Redis jobs.
  const existing = await queue.getJob(job.id).catch(() => null);
  if (existing) {
    await existing.remove().catch(() => {});
  }
  const bullJob = await queue.add(
    job.jobType,
    {
      ledgerJobId: job.id,
      jobType: job.jobType,
      ...job.payload,
      organizationId: job.organizationId,
      businessId: job.businessId,
    },
    {
      jobId: job.id,
      priority: job.priority,
      attempts: job.maxAttempts,
    }
  );
  await markLedgerEnqueued(job.id, {
    queueJobId: String(bullJob.id ?? job.id),
    enqueueState: "enqueued",
  });
}

/** Best-effort remove a Redis job so cancel/retry cannot race a stale worker. */
export async function bullmqRemoveLedgerJob(
  queueName: QueueName,
  jobId: string
): Promise<void> {
  const queue = await getQueue(queueName);
  const existing = await queue.getJob(jobId).catch(() => null);
  if (existing) await existing.remove().catch(() => {});
}

export async function closeBullmqConnections(): Promise<void> {
  for (const q of queues.values()) {
    await q.close().catch(() => {});
  }
  queues.clear();
}
