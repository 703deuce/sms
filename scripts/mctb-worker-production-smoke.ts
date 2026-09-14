#!/usr/bin/env npx tsx
/**
 * Non-destructive MCTB worker transport smoke (DB → BullMQ → worker → handler).
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-worker-production-smoke.ts
 */
import { getPrisma } from "@/lib/db";
import { MCTB_QUEUE_NAME } from "@/lib/mctb/messaging/inbound-sms-ingress";
import { wakeDurableJobQueueRowToBullmq, useBullmqQueueDriver } from "@/lib/jobs/bullmq";
import { JOB_PRIORITY_MCTB_INBOUND_SMS } from "@/lib/jobs/job-priority";

const POLL_MS = 2000;
const TIMEOUT_MS = 120_000;

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const prisma = getPrisma();
  const issuedAt = new Date().toISOString();
  const idempotencyKey = `mctb-worker-smoke:${issuedAt.slice(0, 16)}`;

  const existing = await prisma.jobQueue.findUnique({ where: { idempotencyKey } });
  if (existing?.status === "completed") {
    console.log(JSON.stringify({ ok: true, reused: true, jobId: existing.id }, null, 2));
    return;
  }

  const job =
    existing ??
    (await prisma.jobQueue.create({
      data: {
        jobType: "mctb_worker_smoke",
        queueName: MCTB_QUEUE_NAME,
        priority: JOB_PRIORITY_MCTB_INBOUND_SMS,
        maxAttempts: 3,
        idempotencyKey,
        payload: { issuedAt, purpose: "mctb_worker_transport_smoke" },
      },
    }));

  const report: Record<string, unknown> = {
    DB_CREATED: true,
    jobId: job.id,
    idempotencyKey,
    queueDriver: useBullmqQueueDriver() ? "bullmq" : "db",
  };

  const wake = await wakeDurableJobQueueRowToBullmq({
    queueName: MCTB_QUEUE_NAME,
    jobType: "mctb_worker_smoke",
    idempotencyKey,
    payload: { issuedAt, purpose: "mctb_worker_transport_smoke" },
  });
  report.BULLMQ_ENQUEUED = wake.enqueued;
  report.bullmqWake = wake;

  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const row = await prisma.jobQueue.findUnique({ where: { id: job.id } });
    if (!row) break;
    if (row.status === "completed") {
      report.WORKER_CLAIMED = true;
      report.HANDLER_RAN = true;
      report.DB_COMPLETED = true;
      report.ok = true;
      report.completedAt = row.completedAt;
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    if (row.status === "failed") {
      report.ok = false;
      report.lastError = row.lastError;
      console.log(JSON.stringify(report, null, 2));
      process.exit(1);
    }
    if (row.status === "processing" || row.attempts > 0) {
      report.WORKER_CLAIMED = true;
    }
    await sleep(POLL_MS);
  }

  report.ok = false;
  report.error = "timeout_waiting_for_completion";
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
