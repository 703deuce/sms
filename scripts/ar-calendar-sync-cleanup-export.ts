/**
 * Production cleanup scope export (read-only). Writes JSON artifacts under EXPORT_DIR.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   EXPORT_DIR=/tmp/calendar-cleanup-export \
 *   npx tsx scripts/ar-calendar-sync-cleanup-export.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPrisma } from "../src/lib/db";
import {
  AR_SCALE_TEST_WORKSPACE_NAME,
  isLikelyDisposableMicrosoftCalendarConnection,
  isProtectedMicrosoftCalendarConnection,
  isMctbPerfTestWorkspaceId,
} from "../src/lib/calendar/disposable-calendar-test-data";

const JOB = "calendar_connection_sync";
const exportDir = process.env.EXPORT_DIR || "/tmp/calendar-cleanup-export";

type ConnClass = "disposable" | "protected" | "review";

async function main() {
  mkdirSync(exportDir, { recursive: true });
  const prisma = getPrisma();

  const scaleTestWorkspaces = await prisma.workspace.findMany({
    where: { name: AR_SCALE_TEST_WORKSPACE_NAME },
    select: { id: true, name: true, slug: true },
  });
  const scaleTestWorkspaceIds = new Set(scaleTestWorkspaces.map((w) => w.id));

  const connectionsByClass: Record<ConnClass, string[]> = {
    disposable: [],
    protected: [],
    review: [],
  };
  const reviewWorkspaceCounts = new Map<string, number>();

  let cursor: string | undefined;
  const pageSize = 500;
  let totalConnections = 0;

  while (true) {
    const batch = await prisma.voiceCalendarConnection.findMany({
      where: {
        provider: "microsoft",
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: pageSize,
      select: {
        id: true,
        workspaceId: true,
        status: true,
        credentialsRef: true,
        name: true,
        provider: true,
      },
    });
    if (!batch.length) break;
    for (const conn of batch) {
      totalConnections += 1;
      const prot = isProtectedMicrosoftCalendarConnection(conn);
      if (prot.protected) {
        connectionsByClass.protected.push(conn.id);
        continue;
      }
      if (
        isLikelyDisposableMicrosoftCalendarConnection(conn, { scaleTestWorkspaceIds })
      ) {
        connectionsByClass.disposable.push(conn.id);
      } else {
        connectionsByClass.review.push(conn.id);
        reviewWorkspaceCounts.set(
          conn.workspaceId,
          (reviewWorkspaceCounts.get(conn.workspaceId) ?? 0) + 1,
        );
      }
    }
    cursor = batch[batch.length - 1].id;
    if (batch.length < pageSize) break;
  }

  const disposableSet = new Set(connectionsByClass.disposable);
  const protectedSet = new Set(connectionsByClass.protected);

  let jobCounts = { disposable: 0, protected: 0, review: 0, total: 0 };
  const disposableJobSample: string[] = [];
  const reviewJobSample: string[] = [];
  const reviewWorkspaceJobCounts = new Map<string, number>();

  let jobCursor: string | undefined;
  while (true) {
    const jobs = await prisma.jobQueue.findMany({
      where: {
        jobType: JOB,
        status: { in: ["pending", "deferred"] },
        ...(jobCursor ? { id: { gt: jobCursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: 500,
      select: { id: true, workspaceId: true, payload: true },
    });
    if (!jobs.length) break;
    for (const job of jobs) {
      jobCounts.total += 1;
      const connectionId = (job.payload as { connectionId?: string })?.connectionId ?? "";
      const wsDisposable = job.workspaceId ? isMctbPerfTestWorkspaceId(job.workspaceId) : false;
      if (protectedSet.has(connectionId)) {
        jobCounts.protected += 1;
      } else if (disposableSet.has(connectionId) || wsDisposable) {
        jobCounts.disposable += 1;
        if (disposableJobSample.length < 50) disposableJobSample.push(job.id);
      } else {
        jobCounts.review += 1;
        if (reviewJobSample.length < 50) reviewJobSample.push(job.id);
        const ws = job.workspaceId ?? "unknown";
        reviewWorkspaceJobCounts.set(ws, (reviewWorkspaceJobCounts.get(ws) ?? 0) + 1);
      }
    }
    jobCursor = jobs[jobs.length - 1].id;
    if (jobs.length < 2000) break;
  }

  const summary = {
    probedAt: new Date().toISOString(),
    totalMicrosoftConnections: totalConnections,
    connectionCounts: {
      disposable: connectionsByClass.disposable.length,
      protected: connectionsByClass.protected.length,
      review: connectionsByClass.review.length,
    },
    pendingCalendarSyncJobCounts: jobCounts,
    arScaleTestWorkspaces: scaleTestWorkspaces,
    reviewWorkspaceConnectionCounts: Object.fromEntries(
      [...reviewWorkspaceCounts.entries()].sort((a, b) => b[1] - a[1]),
    ),
    reviewWorkspacePendingJobCounts: Object.fromEntries(
      [...reviewWorkspaceJobCounts.entries()].sort((a, b) => b[1] - a[1]),
    ),
    disposableJobIdSample: disposableJobSample,
    reviewJobIdSample: reviewJobSample,
    mctbP0pfWorkspaceNote: "Disposable includes workspaceId prefix mctb_p0pf_*",
  };

  writeFileSync(join(exportDir, "cleanup-scope-summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(
    join(exportDir, "disposable-connection-ids.json"),
    JSON.stringify(connectionsByClass.disposable),
  );
  writeFileSync(
    join(exportDir, "protected-connection-ids.json"),
    JSON.stringify(connectionsByClass.protected),
  );
  writeFileSync(
    join(exportDir, "review-connection-ids.json"),
    JSON.stringify(connectionsByClass.review),
  );

  console.log(JSON.stringify({ exportDir, summary }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
