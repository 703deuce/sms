/**
 * Regression: job_queue retention classification + scoped prune integration.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-job-queue-lifecycle.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { getPrisma } from "@/lib/db";
import {
  isProcessDueJobsSchedulerJobType,
  isRowOlderThanCutoff,
  pruneTerminalJobQueueRows,
  selectTerminalRowIdsForPrune,
} from "@/lib/jobs/job-queue-lifecycle";

function main() {
  const now = Date.now();
  const h12 = 12 * 60 * 60 * 1000;
  const h72 = 72 * 60 * 60 * 1000;
  const d10 = 10 * 24 * 60 * 60 * 1000;
  const d35 = 35 * 24 * 60 * 60 * 1000;
  const d100 = 100 * 24 * 60 * 60 * 1000;

  const schedCutoff = new Date(now - 48 * 60 * 60 * 1000);
  const normalCutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const failedCutoff = new Date(now - 90 * 24 * 60 * 60 * 1000);

  const rows = [
    {
      id: "sched-recent",
      jobType: "crm_task_due_scan",
      completedAt: new Date(now - h12),
      updatedAt: new Date(now - h12),
    },
    {
      id: "sched-old",
      jobType: "crm_task_due_scan",
      completedAt: new Date(now - h72),
      updatedAt: new Date(now - h72),
    },
    {
      id: "normal-mid",
      jobType: "send_campaign_sms",
      completedAt: new Date(now - d10),
      updatedAt: new Date(now - d10),
    },
    {
      id: "normal-old",
      jobType: "send_campaign_sms",
      completedAt: new Date(now - d35),
      updatedAt: new Date(now - d35),
    },
    {
      id: "failed-recent",
      jobType: "send_campaign_sms",
      completedAt: new Date(now - d10),
      updatedAt: new Date(now - d10),
    },
    {
      id: "failed-old",
      jobType: "send_campaign_sms",
      completedAt: new Date(now - d100),
      updatedAt: new Date(now - d100),
    },
  ];

  assert.ok(isProcessDueJobsSchedulerJobType("crm_task_due_scan"));
  assert.ok(!isProcessDueJobsSchedulerJobType("send_campaign_sms"));

  const schedPrune = selectTerminalRowIdsForPrune(
    rows.filter((r) => isProcessDueJobsSchedulerJobType(r.jobType)),
    schedCutoff,
    100,
  );
  assert.deepEqual(schedPrune, ["sched-old"]);

  const normalPrune = selectTerminalRowIdsForPrune(
    rows.filter((r) => !isProcessDueJobsSchedulerJobType(r.jobType) && r.id.startsWith("normal")),
    normalCutoff,
    100,
  );
  assert.deepEqual(normalPrune, ["normal-old"]);

  assert.equal(isRowOlderThanCutoff(rows[4], failedCutoff), false);
  assert.equal(isRowOlderThanCutoff(rows[5], failedCutoff), true);

  console.log("  ✓ retention classification (scheduler 48h / normal 30d / failed 90d)");
}

async function integrationScopedPrune() {
  const prisma = getPrisma();
  const prefix = `jq-test-${randomBytes(4).toString("hex")}-`;
  const now = Date.now();
  const idOld = `${prefix}old`;
  await prisma.jobQueue.create({
    data: {
      id: idOld,
      jobType: "job_queue_lifecycle_scheduler_fixture",
      queueName: "maintenance",
      payload: {},
      status: "completed",
      idempotencyKey: `k-${idOld}`,
      runAfter: new Date(),
    },
  });
  await prisma.jobQueue.update({
    where: { id: idOld },
    data: {
      completedAt: new Date(now - 72 * 60 * 60 * 1000),
      updatedAt: new Date(now - 72 * 60 * 60 * 1000),
    },
  });

  const result = await pruneTerminalJobQueueRows(
    {
      schedulerCompletedRetentionHours: 48,
      completedRetentionDays: 30,
      failedRetentionDays: 90,
      batchSize: 500,
      maxBatchesPerRun: 5,
    },
    { idPrefix: prefix },
  );
  assert.ok(result.schedulerCompletedDeleted >= 1);
  const left = await prisma.jobQueue.findUnique({ where: { id: idOld } });
  assert.equal(left, null);
  console.log("  ✓ scoped integration prune deletes only eligible scheduler row");
}

main();
integrationScopedPrune()
  .then(() => {
    console.log("job_queue_lifecycle: PASS");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
