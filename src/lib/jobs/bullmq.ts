import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { handleJob } from "./job-handlers";
import { JobDeferredError } from "@/lib/messaging/types";

function connection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL required for BullMQ");
  return new IORedis(url, { maxRetriesPerRequest: null });
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
        } catch (err) {
          if (err instanceof JobDeferredError) {
            // Re-delay with Twilio poll spacing instead of generic backoff
            await job.moveToDelayed(Date.now() + err.deferMs, job.token);
            return;
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
  await queue.add(jobName, data, {
    jobId: opts?.jobId,
    delay: opts?.delay,
    removeOnComplete: 1000,
    removeOnFail: 5000,
    attempts: 8,
    backoff: { type: "exponential", delay: 15_000 },
  });
}
