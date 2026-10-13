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

/** Read-only Redis memory summary for job-queue / ops health probes. */
export async function getBullmqRedisMemorySummary(): Promise<
  | {
      usedMemoryBytes: number;
      usedMemoryHuman: string;
      maxMemoryBytes: number | null;
      maxMemoryHuman: string | null;
      maxmemoryPolicy: string | null;
    }
  | undefined
> {
  if (!process.env.REDIS_URL?.trim()) return undefined;
  const conn = connection();
  try {
    const info = await conn.info("memory");
    const used = /used_memory:(\d+)/.exec(info)?.[1];
    const usedHuman = /used_memory_human:([^\r\n]+)/.exec(info)?.[1]?.trim();
    const maxCfg = await conn.config("GET", "maxmemory").catch(() => null);
    const policyCfg = await conn.config("GET", "maxmemory-policy").catch(() => null);
    const maxRaw = maxCfg && typeof maxCfg === "object" && "maxmemory" in maxCfg
      ? String((maxCfg as { maxmemory?: string }).maxmemory)
      : Array.isArray(maxCfg)
        ? String(maxCfg[1] ?? "")
        : "";
    const maxBytes = maxRaw && maxRaw !== "0" ? Number(maxRaw) : null;
    const policy =
      policyCfg && typeof policyCfg === "object" && "maxmemory-policy" in policyCfg
        ? String((policyCfg as { "maxmemory-policy"?: string })["maxmemory-policy"])
        : Array.isArray(policyCfg)
          ? String(policyCfg[1] ?? "")
          : null;
    if (!used) return undefined;
    return {
      usedMemoryBytes: Number(used),
      usedMemoryHuman: usedHuman || `${used}B`,
      maxMemoryBytes: maxBytes != null && Number.isFinite(maxBytes) ? maxBytes : null,
      maxMemoryHuman:
        maxBytes != null && Number.isFinite(maxBytes) && maxBytes > 0
          ? `${Math.round(maxBytes / (1024 * 1024))}MiB cap`
          : null,
      maxmemoryPolicy: policy,
    };
  } catch {
    return undefined;
  }
}
