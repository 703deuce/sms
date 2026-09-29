#!/usr/bin/env npx tsx
/**
 * Prune terminal job_queue rows older than retention (operational history only).
 * DRY_RUN=1 default. Does not delete pending/processing/deferred.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/operations/prune-completed-job-queue.ts
 */
import { getPrisma } from "@/lib/db";

const EXECUTE = process.env.EXECUTE === "1";
const RETENTION_DAYS = Number(process.env.JOB_QUEUE_RETENTION_DAYS || 90);
const BATCH = Number(process.env.CLEANUP_BATCH_SIZE || 500);
const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

async function main() {
  const prisma = getPrisma();
  const where = {
    status: { in: ["completed", "failed"] as const },
    completedAt: { lt: cutoff },
  };
  const total = await prisma.jobQueue.count({ where });
  console.log(
    JSON.stringify(
      { event: "job_queue_prune_plan", EXECUTE, RETENTION_DAYS, cutoff: cutoff.toISOString(), rows: total },
      null,
      2,
    ),
  );
  if (!EXECUTE) return;
  let deleted = 0;
  for (;;) {
    const rows = await prisma.jobQueue.findMany({ where, select: { id: true }, take: BATCH });
    if (!rows.length) break;
    await prisma.jobQueue.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
    deleted += rows.length;
  }
  console.log(JSON.stringify({ event: "job_queue_prune_done", deleted }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
