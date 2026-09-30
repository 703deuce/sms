import {
  MCTB_DISPATCH_BULLMQ_QUEUES,
  PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES,
  SMS_DISPATCH_BULLMQ_QUEUES,
  VOICE_DISPATCH_BULLMQ_QUEUES,
  getBullmqRedisUrl,
} from "@/lib/jobs/bullmq";
import { Queue } from "bullmq";
import IORedis from "ioredis";

let sharedConnection: IORedis | null = null;

function connection(): IORedis {
  if (!sharedConnection) {
    sharedConnection = new IORedis(getBullmqRedisUrl(), {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return sharedConnection;
}

const QUEUE_NAMES = [
  ...new Set([
    ...PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES,
    ...SMS_DISPATCH_BULLMQ_QUEUES,
    ...MCTB_DISPATCH_BULLMQ_QUEUES,
    ...VOICE_DISPATCH_BULLMQ_QUEUES,
    "maintenance",
    "default",
  ]),
];

export async function getBullmqQueueDepths(): Promise<{
  waiting: number;
  delayed: number;
  failed: number;
}> {
  const conn = connection();
  let waiting = 0;
  let delayed = 0;
  let failed = 0;
  for (const name of QUEUE_NAMES) {
    const queue = new Queue(name, { connection: conn });
    try {
      const counts = await queue.getJobCounts("waiting", "delayed", "failed");
      waiting += counts.waiting ?? 0;
      delayed += counts.delayed ?? 0;
      failed += counts.failed ?? 0;
    } finally {
      await queue.close();
    }
  }
  return { waiting, delayed, failed };
}
