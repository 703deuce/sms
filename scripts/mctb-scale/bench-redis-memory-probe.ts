#!/usr/bin/env npx tsx
/**
 * Approximate Redis memory growth for queued BullMQ smoke jobs (disposable).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-scale/bench-redis-memory-probe.ts
 */
import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { enqueueBullmq } from "@/lib/jobs/bullmq";
import { MCTB_QUEUE_NAME } from "@/lib/mctb/messaging/inbound-sms-ingress";
import { JOB_PRIORITY_MCTB_INBOUND_SMS } from "@/lib/jobs/job-priority";
import { assertBenchDatabaseAllowed } from "./bench-guard";

assertBenchDatabaseAllowed();

const LEVELS = (process.env.MCTB_BENCH_REDIS_JOB_COUNTS || "50,100,200")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => n > 0);

async function redisUsedBytes(): Promise<number> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) throw new Error("REDIS_URL required");
  const client = new Redis(url, { maxRetriesPerRequest: null });
  try {
    const info = await client.info("memory");
    const m = info.match(/used_memory:(\d+)/);
    return m ? Number(m[1]) : 0;
  } finally {
    await client.quit();
  }
}

async function enqueueSmoke(n: number, delayMs: number) {
  const prisma = getPrisma();
  const stamp = Date.now();
  const keys: string[] = [];
  for (let i = 0; i < n; i++) {
    const idempotencyKey = `mctb-bench-redis-mem:${stamp}:${i}`;
    keys.push(idempotencyKey);
    const runAfter = new Date(Date.now() + delayMs);
    await prisma.jobQueue.create({
      data: {
        jobType: "mctb_worker_smoke",
        queueName: MCTB_QUEUE_NAME,
        priority: JOB_PRIORITY_MCTB_INBOUND_SMS,
        maxAttempts: 3,
        idempotencyKey,
        runAfter,
        payload: { bench: "redis_mem", i },
      },
    });
    await enqueueBullmq(
      MCTB_QUEUE_NAME,
      "mctb_worker_smoke",
      { bench: "redis_mem", i },
      { jobId: idempotencyKey, delay: delayMs },
    );
  }
  return keys;
}

async function cleanup(keys: string[]) {
  const prisma = getPrisma();
  const chunk = 100;
  for (let i = 0; i < keys.length; i += chunk) {
    const slice = keys.slice(i, i + chunk);
    await prisma.jobQueue.deleteMany({ where: { idempotencyKey: { in: slice } } });
  }
}

async function main() {
  const baseline = await redisUsedBytes();
  const results = [];
  for (const n of LEVELS) {
    const before = await redisUsedBytes();
    const keys = await enqueueSmoke(n, 3600_000);
    const after = await redisUsedBytes();
    const delta = after - before;
    results.push({
      workload: "redis_delayed_smoke_jobs",
      testedLevel: n,
      pass: true,
      usedMemoryMb: Math.round((after / 1024 / 1024) * 100) / 100,
      deltaBytes: delta,
      approxBytesPerJob: n > 0 ? Math.round(delta / n) : 0,
      projectedJobsAt768Mb:
        delta > 0 ? Math.floor((768 * 1024 * 1024 * 0.7) / (delta / n)) : null,
    });
    await cleanup(keys);
  }
  console.log(
    JSON.stringify(
      {
        event: "mctb_bench_redis_memory",
        baselineBytes: baseline,
        maxmemoryPolicy: "noeviction",
        maxmemoryMb: 768,
        results,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
