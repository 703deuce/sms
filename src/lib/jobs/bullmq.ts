import { DelayedError, Queue, UnrecoverableError, Worker } from "bullmq";
import IORedis from "ioredis";
import { handleJob } from "./job-handlers";
import { JobDeferredError, JobFailedError } from "@/lib/messaging/types";
import { completeJob, failJob } from "@/lib/messaging/enqueue-advance";
import { getPrisma } from "@/lib/db";

let sharedConnection: IORedis | null = null;
const queueCache = new Map<string, Queue>();

function connection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL required for BullMQ");
  if (!sharedConnection) {
    sharedConnection = new IORedis(url, { maxRetriesPerRequest: null });
  }
  return sharedConnection;
}

function getQueue(queueName: string) {
  let queue = queueCache.get(queueName);
  if (!queue) {
    queue = new Queue(queueName, { connection: connection() });
    queueCache.set(queueName, queue);
  }
  return queue;
}

async function syncDbJob(idempotencyKey: string | undefined, outcome: "completed" | "failed", error?: string) {
  if (!idempotencyKey) return;
  const job = await getPrisma().jobQueue.findUnique({ where: { idempotencyKey } });
  if (!job) return;
  if (outcome === "completed") await completeJob(job.id);
  else await failJob(job.id, error || "failed", undefined, undefined, true);
}

export async function startBullmqWorkers() {
  const conn = connection();

  const queues = ["review-campaign", "sms-send", "email-send", "review-import", "automations"] as const;

  for (const name of queues) {
    void getQueue(name);

    void new Worker(
      name,
      async (job) => {
        try {
          await handleJob(job.name, (job.data || {}) as Record<string, unknown>);
          await syncDbJob(job.id, "completed");
        } catch (err) {
          if (err instanceof JobDeferredError) {
            // Mirror soft defer into DB outbox so cron doesn't promote early forever
            if (job.id) {
              const row = await getPrisma().jobQueue.findUnique({
                where: { idempotencyKey: job.id },
              });
              if (row) {
                await failJob(row.id, err.message, err.deferMs, err.soft);
              }
            }
            await job.moveToDelayed(Date.now() + err.deferMs, job.token);
            throw new DelayedError();
          }
          const message = err instanceof Error ? err.message : String(err);
          if (err instanceof JobFailedError) {
            await syncDbJob(job.id, "failed", message);
            throw new UnrecoverableError(message);
          }
          throw err;
        }
      },
      {
        connection: conn,
        concurrency: name.endsWith("send") ? 5 : 2,
      },
    );
  }
}

export async function enqueueBullmq(
  queueName: string,
  jobName: string,
  data: Record<string, unknown>,
  opts?: { jobId?: string; delay?: number; wake?: boolean },
) {
  const queue = getQueue(queueName);
  const isRegistration = jobName === "messaging_registration_advance";

  // If a prior run completed/failed under the same jobId, remove it so re-advance works
  if (opts?.jobId) {
    const existing = await queue.getJob(opts.jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "completed" || state === "failed") {
        await existing.remove();
      } else if (state === "delayed") {
        // Wake immediately when requested (compliance webhook / refresh), else bump delay
        if (opts.wake || !opts.delay) {
          await existing.promote();
        } else {
          await existing.changeDelay(opts.delay);
        }
        return;
      } else if (state === "waiting" || state === "prioritized" || state === "active") {
        return;
      }
    }
  }

  await queue.add(jobName, data, {
    jobId: opts?.jobId,
    delay: opts?.delay,
    removeOnComplete: 1000,
    removeOnFail: 5000,
    // Registration polls need many soft retries; send jobs stay modest
    attempts: isRegistration ? 500 : 8,
    backoff: { type: "exponential", delay: 15_000 },
  });
}

/** Push due DB outbox rows into BullMQ (recovers dual-write failures). */
export async function syncDbOutboxToBullmq(limit = 50) {
  const prisma = getPrisma();
  const now = new Date();
  const due = await prisma.jobQueue.findMany({
    where: {
      status: { in: ["pending", "deferred"] },
      runAfter: { lte: now },
    },
    orderBy: { runAfter: "asc" },
    take: limit,
  });

  let synced = 0;
  for (const job of due) {
    try {
      const delay = Math.max(0, job.runAfter.getTime() - Date.now());
      await enqueueBullmq(
        job.queueName,
        job.jobType,
        (job.payload || {}) as Record<string, unknown>,
        {
          jobId: job.idempotencyKey || job.id,
          delay: delay || undefined,
          wake: delay === 0,
        },
      );
      synced += 1;
    } catch (err) {
      console.warn("[syncDbOutboxToBullmq] failed for", job.id, err);
    }
  }
  return { synced };
}
