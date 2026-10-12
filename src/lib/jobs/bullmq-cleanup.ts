import "server-only";

import { Queue } from "bullmq";
import { getBullmqConnection, getBullmqRedisUrl } from "@/lib/jobs/bullmq";

/**
 * Remove a BullMQ job by idempotency key (job id in our enqueue path).
 * Safe to call when job already absent from Redis.
 */
export async function removeBullmqJobByIdempotencyKey(queueName: string, idempotencyKey: string) {
  if (!getBullmqRedisUrl()) return { removed: false, reason: "no_redis" };
  const queue = new Queue(queueName, { connection: getBullmqConnection() });
  try {
    const job = await queue.getJob(idempotencyKey);
    if (!job) return { removed: false, reason: "not_found" };
    await job.remove();
    return { removed: true };
  } finally {
    await queue.close();
  }
}
