#!/usr/bin/env npx tsx
/**
 * Measures Postgres jobQueue + BullMQ enqueue throughput (disposable smoke jobs).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-scale/bench-outbox-enqueue.ts
 */
import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { enqueueBullmq } from "@/lib/jobs/bullmq";
import { MCTB_QUEUE_NAME } from "@/lib/mctb/messaging/inbound-sms-ingress";
import { JOB_PRIORITY_MCTB_INBOUND_SMS } from "@/lib/jobs/job-priority";

const COUNTS = (process.env.MCTB_BENCH_ENQUEUE_COUNTS || "50,100,200")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => n > 0);

function pct(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

async function benchCount(n: number) {
  const prisma = getPrisma();
  const latencies: number[] = [];
  const stamp = Date.now();
  const keys: string[] = [];

  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    const idempotencyKey = `mctb-bench-enqueue:${stamp}:${i}`;
    keys.push(idempotencyKey);
    const t1 = performance.now();
    await prisma.jobQueue.create({
      data: {
        jobType: "mctb_worker_smoke",
        queueName: MCTB_QUEUE_NAME,
        priority: JOB_PRIORITY_MCTB_INBOUND_SMS,
        maxAttempts: 3,
        idempotencyKey,
        payload: { bench: true, i },
      },
    });
    await enqueueBullmq(MCTB_QUEUE_NAME, "mctb_worker_smoke", { bench: true, i }, {
      jobId: idempotencyKey,
    });
    latencies.push(performance.now() - t1);
  }
  const totalMs = performance.now() - t0;
  latencies.sort((a, b) => a - b);
  return {
    n,
    totalMs,
    jobsPerSec: (n / totalMs) * 1000,
    p50Ms: pct(latencies, 50),
    p95Ms: pct(latencies, 95),
    p99Ms: pct(latencies, 99),
    keys,
  };
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
  const results = [];
  for (const n of COUNTS) {
    const r = await benchCount(n);
    results.push({
      workload: "outbox_enqueue_smoke",
      testedLevel: n,
      pass: true,
      jobsPerSec: Math.round(r.jobsPerSec * 10) / 10,
      p50Ms: Math.round(r.p50Ms),
      p95Ms: Math.round(r.p95Ms),
      p99Ms: Math.round(r.p99Ms),
      totalMs: Math.round(r.totalMs),
    });
    await cleanup(r.keys);
  }
  console.log(JSON.stringify({ event: "mctb_bench_outbox_enqueue", results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
