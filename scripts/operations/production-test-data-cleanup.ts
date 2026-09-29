#!/usr/bin/env npx tsx
/**
 * Surgical production test-data cleanup. Requires verified PRE_TEST_DATA_CLEANUP backup.
 *
 * DRY_RUN=1 (default) — counts only
 * EXECUTE=1 — perform deletes (irreversible without backup restore)
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/operations/production-test-data-cleanup.ts
 */
import { getPrisma } from "@/lib/db";

const PRESERVE = process.env.PRESERVE_WORKSPACE_ID?.trim() || "ws_1";
const EXECUTE = process.env.EXECUTE === "1";
const BATCH = Number(process.env.CLEANUP_BATCH_SIZE || 5000);

/** Classified TEST / DISPOSABLE from inventory (2026-09-29). UNKNOWN BullMQ cert → disposable. */
const DISPOSABLE_WORKSPACE_IDS = [
  "cmubqu0bx4v5o2m6s42083b2t",
  "mctb_usage_test_be287ad8",
  "mctb_usage_test_8c684ab8",
  "mctb_usage_test_895ba575",
  "mctb_usage_test_0f9502f0",
  "mctb_ing_b7fb9bce",
  "cmuks7622236q6b6v0j4s5c4o",
  "mctb_press1_71a87249-5",
  "mctb_press1_96b38e9a-3",
  "cmun7x8fi55693k6t101e4607",
] as const;

async function batchDeleteJobQueue(where: object, label: string) {
  const prisma = getPrisma();
  let total = 0;
  for (;;) {
    const rows = await prisma.jobQueue.findMany({
      where,
      select: { id: true },
      take: BATCH,
    });
    if (!rows.length) break;
    const ids = rows.map((r) => r.id);
    if (EXECUTE) {
      await prisma.jobQueue.deleteMany({ where: { id: { in: ids } } });
    }
    total += ids.length;
    if (total % 50000 === 0 || rows.length < BATCH) {
      console.log(JSON.stringify({ phase: label, mode: EXECUTE ? "execute" : "dry_run", deletedSoFar: total }));
    }
    if (!EXECUTE && total >= 100000) {
      console.log(JSON.stringify({ phase: label, note: "dry_run_cap", estimatedAtLeast: total }));
      break;
    }
  }
  return total;
}

async function main() {
  const prisma = getPrisma();
  if (DISPOSABLE_WORKSPACE_IDS.includes(PRESERVE as (typeof DISPOSABLE_WORKSPACE_IDS)[number])) {
    throw new Error("PRESERVE workspace cannot be in disposable list");
  }

  const before = {
    workspaces: await prisma.workspace.count(),
    jobQueue: await prisma.jobQueue.count(),
    ws1Jobs: await prisma.jobQueue.count({ where: { workspaceId: PRESERVE } }),
    ws1Pending: await prisma.jobQueue.count({
      where: { workspaceId: PRESERVE, status: { in: ["pending", "deferred", "processing"] } },
    }),
  };

  const plan: Record<string, number> = {};

  for (const wsId of DISPOSABLE_WORKSPACE_IDS) {
    plan[`workspace_delete:${wsId}`] = await prisma.workspace.count({ where: { id: wsId } });
  }

  plan["jobs_null_completed"] = await prisma.jobQueue.count({
    where: { workspaceId: null, status: "completed" },
  });
  plan["jobs_null_failed_smoke"] = await prisma.jobQueue.count({
    where: {
      workspaceId: null,
      status: "failed",
      OR: [
        { jobType: "mctb_worker_smoke" },
        { idempotencyKey: { startsWith: "mctb-bench" } },
      ],
    },
  });
  plan["jobs_bench_all_status"] = await prisma.jobQueue.count({
    where: { idempotencyKey: { startsWith: "mctb-bench" } },
  });
  plan["jobs_disposable_workspace"] = await prisma.jobQueue.count({
    where: { workspaceId: { in: [...DISPOSABLE_WORKSPACE_IDS] } },
  });

  console.log(JSON.stringify({ event: "cleanup_plan", EXECUTE, before, plan }, null, 2));

  if (!EXECUTE) {
    console.log(JSON.stringify({ event: "cleanup_dry_run_complete", message: "Set EXECUTE=1 to apply" }));
    return;
  }

  // 1) Jobs tied to disposable workspaces (before workspace delete)
  await batchDeleteJobQueue(
    { workspaceId: { in: [...DISPOSABLE_WORKSPACE_IDS] } },
    "disposable_workspace_jobs",
  );

  // 2) Delete disposable workspaces (FK cascade)
  for (const wsId of DISPOSABLE_WORKSPACE_IDS) {
    const exists = await prisma.workspace.findUnique({ where: { id: wsId }, select: { id: true } });
    if (!exists) continue;
    await prisma.workspace.delete({ where: { id: wsId } });
    console.log(JSON.stringify({ event: "workspace_deleted", workspaceId: wsId }));
  }

  // 3) Global operational completed jobs (no workspace) — not customer history
  const nNullCompleted = await batchDeleteJobQueue(
    { workspaceId: null, status: "completed" },
    "null_workspace_completed",
  );

  // 4) Failed bench/smoke
  const nBench = await batchDeleteJobQueue(
    { idempotencyKey: { startsWith: "mctb-bench" } },
    "mctb_bench_jobs",
  );
  const nSmokeFailed = await batchDeleteJobQueue(
    { jobType: "mctb_worker_smoke", status: { in: ["failed", "completed"] } },
    "mctb_worker_smoke_terminal",
  );

  const after = {
    workspaces: await prisma.workspace.count(),
    jobQueue: await prisma.jobQueue.count(),
    ws1Jobs: await prisma.jobQueue.count({ where: { workspaceId: PRESERVE } }),
    ws1Pending: await prisma.jobQueue.count({
      where: { workspaceId: PRESERVE, status: { in: ["pending", "deferred", "processing"] } },
    }),
  };

  console.log(
    JSON.stringify(
      {
        event: "cleanup_execute_complete",
        removed: { nNullCompleted, nBench, nSmokeFailed },
        after,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
