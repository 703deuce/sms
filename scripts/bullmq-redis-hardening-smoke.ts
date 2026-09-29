#!/usr/bin/env npx tsx
/**
 * Disposable BullMQ hardening checks (delayed job + idempotent re-wake).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/bullmq-redis-hardening-smoke.ts
 */
import { getPrisma } from "@/lib/db";
import { MCTB_QUEUE_NAME } from "@/lib/mctb/messaging/inbound-sms-ingress";
import { enqueueBullmq, wakeDurableJobQueueRowToBullmq } from "@/lib/jobs/bullmq";
import { JOB_PRIORITY_MCTB_INBOUND_SMS } from "@/lib/jobs/job-priority";

const DELAY_MS = Number(process.env.BULLMQ_HARDENING_DELAY_MS || 12_000);
const POLL_MS = 1500;
const TIMEOUT_MS = 180_000;

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForJob(jobId: string) {
  const prisma = getPrisma();
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const row = await prisma.jobQueue.findUnique({ where: { id: jobId } });
    if (row?.status === "completed") return { ok: true as const, row };
    if (row?.status === "failed") return { ok: false as const, row };
    await sleep(POLL_MS);
  }
  return { ok: false as const, row: null, error: "timeout" };
}

async function main() {
  const prisma = getPrisma();
  const stamp = Date.now();
  const delayKey = `bullmq-hardening-delay:${stamp}`;
  const runAfter = new Date(Date.now() + DELAY_MS);

  const delayJob = await prisma.jobQueue.create({
    data: {
      jobType: "mctb_worker_smoke",
      queueName: MCTB_QUEUE_NAME,
      priority: JOB_PRIORITY_MCTB_INBOUND_SMS,
      maxAttempts: 3,
      idempotencyKey: delayKey,
      runAfter,
      payload: { issuedAt: new Date().toISOString(), purpose: "bullmq_hardening_delayed" },
    },
  });

  await enqueueBullmq(
    MCTB_QUEUE_NAME,
    "mctb_worker_smoke",
    { issuedAt: new Date().toISOString(), purpose: "bullmq_hardening_delayed" },
    { jobId: delayKey, delay: DELAY_MS },
  );

  const delayResult = await waitForJob(delayJob.id);

  const idemKey = `bullmq-hardening-idem:${stamp}`;
  const idemJob = await prisma.jobQueue.create({
    data: {
      jobType: "mctb_worker_smoke",
      queueName: MCTB_QUEUE_NAME,
      priority: JOB_PRIORITY_MCTB_INBOUND_SMS,
      maxAttempts: 3,
      idempotencyKey: idemKey,
      payload: { issuedAt: new Date().toISOString(), purpose: "bullmq_hardening_idem" },
    },
  });
  const w1 = await wakeDurableJobQueueRowToBullmq({
    queueName: MCTB_QUEUE_NAME,
    jobType: "mctb_worker_smoke",
    idempotencyKey: idemKey,
    payload: { issuedAt: new Date().toISOString(), purpose: "bullmq_hardening_idem" },
  });
  const w2 = await wakeDurableJobQueueRowToBullmq({
    queueName: MCTB_QUEUE_NAME,
    jobType: "mctb_worker_smoke",
    idempotencyKey: idemKey,
    payload: { issuedAt: new Date().toISOString(), purpose: "bullmq_hardening_idem" },
  });
  const idemResult = await waitForJob(idemJob.id);
  const attempts = (await prisma.jobQueue.findUnique({ where: { id: idemJob.id } }))?.attempts ?? 0;

  console.log(
    JSON.stringify(
      {
        ok: delayResult.ok && idemResult.ok,
        delayed: { delayMs: DELAY_MS, completed: delayResult.ok, jobId: delayJob.id },
        idempotency: {
          wake1: w1.enqueued,
          wake2: w2.enqueued,
          completed: idemResult.ok,
          attempts,
          jobId: idemJob.id,
        },
      },
      null,
      2,
    ),
  );
  if (!delayResult.ok || !idemResult.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
