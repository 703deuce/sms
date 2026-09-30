/**
 * Regression: job_queue terminal retention pruning (no actionable deletes).
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-job-queue-lifecycle.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { pruneTerminalJobQueueRows } from "@/lib/jobs/job-queue-lifecycle";

function suffix() {
  return randomBytes(4).toString("hex");
}

async function createRow(input: {
  status: "pending" | "processing" | "deferred" | "completed" | "failed";
  completedAt?: Date | null;
  updatedAt?: Date;
  idempotencyKey?: string;
}) {
  const prisma = getPrisma();
  const id = `jq-test-${suffix()}`;
  return prisma.jobQueue.create({
    data: {
      id,
      jobType: "job_queue_lifecycle_test",
      queueName: "maintenance",
      payload: { test: true },
      status: input.status,
      idempotencyKey: input.idempotencyKey ?? `lifecycle-test:${id}`,
      completedAt: input.completedAt ?? null,
      updatedAt: input.updatedAt ?? new Date(),
      runAfter: new Date(),
    },
  });
}

async function main() {
  const prisma = getPrisma();
  const testRetention = {
    completedRetentionDays: 1,
    failedRetentionDays: 1,
    batchSize: 500,
    maxBatchesPerRun: 20,
  };
  const oldCompleted = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const oldFailed = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const recent = new Date();

  const ids: string[] = [];

  const recentCompleted = await createRow({
    status: "completed",
    completedAt: recent,
  });
  ids.push(recentCompleted.id);

  const oldCompletedRow = await createRow({
    status: "completed",
    completedAt: oldCompleted,
    updatedAt: oldCompleted,
  });
  ids.push(oldCompletedRow.id);

  const recentFailed = await createRow({
    status: "failed",
    completedAt: recent,
  });
  ids.push(recentFailed.id);

  const oldFailedRow = await createRow({
    status: "failed",
    completedAt: oldFailed,
    updatedAt: oldFailed,
  });
  ids.push(oldFailedRow.id);

  const stalePending = await createRow({
    status: "pending",
    completedAt: null,
    updatedAt: oldCompleted,
  });
  ids.push(stalePending.id);

  const deferredOld = await createRow({
    status: "deferred",
    completedAt: null,
    updatedAt: oldCompleted,
  });
  ids.push(deferredOld.id);

  const processingOld = await createRow({
    status: "processing",
    completedAt: null,
    updatedAt: oldCompleted,
    idempotencyKey: `lifecycle-processing:${suffix()}`,
  });
  ids.push(processingOld.id);

  const scope = { jobType: "job_queue_lifecycle_test" };
  const first = await pruneTerminalJobQueueRows(testRetention, scope);
  assert.ok(first.completedDeleted >= 1, "old completed should be deleted");
  assert.ok(first.failedDeleted >= 1, "old failed should be deleted");

  const afterFirst = await prisma.jobQueue.findMany({ where: { id: { in: ids } } });
  const byId = new Map(afterFirst.map((r) => [r.id, r]));

  assert.equal(byId.get(recentCompleted.id)?.status, "completed", "recent completed retained");
  assert.equal(byId.get(recentFailed.id)?.status, "failed", "recent failed retained");
  assert.ok(!byId.has(oldCompletedRow.id), "old completed removed");
  assert.ok(!byId.has(oldFailedRow.id), "old failed removed");
  assert.equal(byId.get(stalePending.id)?.status, "pending", "pending never deleted");
  assert.equal(byId.get(deferredOld.id)?.status, "deferred", "deferred never deleted");
  assert.equal(byId.get(processingOld.id)?.status, "processing", "processing never deleted");

  const second = await pruneTerminalJobQueueRows(testRetention, scope);
  assert.equal(second.completedDeleted, 0);
  assert.equal(second.failedDeleted, 0);

  const idemKey = `lifecycle-idem:${suffix()}`;
  const row = await createRow({
    status: "completed",
    completedAt: oldCompleted,
    updatedAt: oldCompleted,
    idempotencyKey: idemKey,
  });
  await prisma.jobQueue.delete({ where: { id: row.id } });
  const re = await enqueueJob({
    jobType: "job_queue_lifecycle_test",
    queueName: "maintenance",
    payload: { test: true },
    idempotencyKey: idemKey,
  });
  assert.equal(re.status, "pending");
  assert.notEqual(re.id, row.id);
  ids.push(re.id);

  await prisma.jobQueue.deleteMany({
    where: { jobType: "job_queue_lifecycle_test" },
  });

  console.log("  ✓ job_queue lifecycle prune retention and idempotency re-enqueue");
  console.log("job_queue_lifecycle: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
