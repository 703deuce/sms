import { DelayedError, Queue, UnrecoverableError, Worker } from "bullmq";
import IORedis from "ioredis";
import { handleJob } from "./job-handlers";
import { JobDeferredError, JobFailedError } from "@/lib/messaging/types";
import { completeJob, failJob } from "@/lib/messaging/enqueue-advance";
import { getPrisma } from "@/lib/db";

function connection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL required for BullMQ");
  return new IORedis(url, { maxRetriesPerRequest: null });
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

  const queues = ["review-campaign", "sms-send", "email-send", "review-import"] as const;

  for (const name of queues) {
    void new Queue(name, { connection: conn });

    void new Worker(
      name,
      async (job) => {
        try {
          await handleJob(job.name, (job.data || {}) as Record<string, unknown>);
          await syncDbJob(job.id, "completed");
        } catch (err) {
          if (err instanceof JobDeferredError) {
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
      { connection: conn, concurrency: name.endsWith("send") ? 5 : 2 },
    );
  }
}

export async function enqueueBullmq(
  queueName: string,
  jobName: string,
  data: Record<string, unknown>,
  opts?: { jobId?: string; delay?: number },
) {
  const conn = connection();
  const queue = new Queue(queueName, { connection: conn });

  // If a prior run completed/failed under the same jobId, remove it so re-advance works
  if (opts?.jobId) {
    const existing = await queue.getJob(opts.jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "completed" || state === "failed") {
        await existing.remove();
      } else if (state === "delayed" || state === "waiting" || state === "prioritized" || state === "active") {
        // Already queued — bump delay if requested
        if (opts.delay && state === "delayed") {
          await existing.changeDelay(opts.delay);
        }
        return;
      }
    }
  }

  await queue.add(jobName, data, {
    jobId: opts?.jobId,
    delay: opts?.delay,
    removeOnComplete: 1000,
    removeOnFail: 5000,
    attempts: 8,
    backoff: { type: "exponential", delay: 15_000 },
  });
}
