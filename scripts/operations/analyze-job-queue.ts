/**
 * Read-only job_queue growth analysis (status, type, workspace, age).
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/operations/analyze-job-queue.ts
 */
import { getPrisma } from "@/lib/db";
import { getJobQueueHealthSnapshot } from "@/lib/jobs/job-queue-lifecycle";

async function main() {
  const prisma = getPrisma();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [byStatus, topCompletedTypes, nullWorkspaceCompleted, wsCompleted, recentCreated] =
    await Promise.all([
      prisma.jobQueue.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.jobQueue.groupBy({
        by: ["jobType"],
        where: { status: "completed" },
        _count: { _all: true },
      }),
      prisma.jobQueue.count({
        where: { workspaceId: null, status: "completed" },
      }),
      prisma.jobQueue.groupBy({
        by: ["workspaceId"],
        where: { status: "completed", workspaceId: { not: null } },
        _count: { _all: true },
      }),
      prisma.jobQueue.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    ]);

  const health = await getJobQueueHealthSnapshot();

  console.log(
    JSON.stringify(
      {
        analyzedAt: now.toISOString(),
        totalRows: byStatus.reduce((s, r) => s + r._count._all, 0),
        byStatus,
        topCompletedJobTypes: topCompletedTypes
          .sort((a, b) => b._count._all - a._count._all)
          .slice(0, 25),
        completedNullWorkspace: nullWorkspaceCompleted,
        completedByWorkspace: wsCompleted
          .sort((a, b) => b._count._all - a._count._all)
          .slice(0, 15),
        rowsCreatedLast30Days: recentCreated,
        health,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect().catch(() => {});
  });
