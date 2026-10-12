/**
 * Read-only cleanup scope report — classifies disposable vs protected calendar sync jobs.
 * Does NOT delete rows or touch Redis.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-calendar-sync-cleanup-dry-run.ts
 */
import { getPrisma } from "../src/lib/db";
import {
  AR_SCALE_TEST_WORKSPACE_NAME,
  isLikelyDisposableMicrosoftCalendarConnection,
  isProtectedMicrosoftCalendarConnection,
  isMctbPerfTestWorkspaceId,
} from "../src/lib/calendar/disposable-calendar-test-data";

const JOB = "calendar_connection_sync";
const PROTECTED_JOB_TYPES = new Set([
  "microsoft_calendar_webhook_process",
  "ar_reminder_dispatch",
  "ar_schedule_reminders",
  "send_campaign_sms",
]);

async function main() {
  const prisma = getPrisma();
  const scaleTestWorkspaces = await prisma.workspace.findMany({
    where: { name: AR_SCALE_TEST_WORKSPACE_NAME },
    select: { id: true },
  });
  const scaleTestWorkspaceIds = new Set(scaleTestWorkspaces.map((w) => w.id));

  const msConnections = await prisma.voiceCalendarConnection.findMany({
    where: { provider: "microsoft" },
    select: {
      id: true,
      workspaceId: true,
      status: true,
      credentialsRef: true,
      name: true,
      provider: true,
    },
    take: 50_000,
  });

  const disposableConnectionIds = new Set<string>();
  const protectedConnectionIds = new Set<string>();
  const reviewConnectionIds = new Set<string>();

  for (const conn of msConnections) {
    const prot = isProtectedMicrosoftCalendarConnection(conn);
    if (prot.protected) {
      protectedConnectionIds.add(conn.id);
      continue;
    }
    if (
      isLikelyDisposableMicrosoftCalendarConnection(conn, {
        scaleTestWorkspaceIds,
      })
    ) {
      disposableConnectionIds.add(conn.id);
    } else {
      reviewConnectionIds.add(conn.id);
    }
  }

  const pendingSyncTotal = await prisma.jobQueue.count({
    where: { jobType: JOB, status: { in: ["pending", "deferred"] } },
  });

  const sampleJobs = await prisma.jobQueue.findMany({
    where: { jobType: JOB, status: { in: ["pending", "deferred"] } },
    take: 10_000,
    select: {
      id: true,
      workspaceId: true,
      payload: true,
      idempotencyKey: true,
      createdAt: true,
    },
  });

  let disposableJobsInSample = 0;
  let protectedJobsInSample = 0;
  let reviewJobsInSample = 0;
  const reviewWorkspaceIds = new Map<string, number>();

  for (const job of sampleJobs) {
    const connectionId = (job.payload as { connectionId?: string })?.connectionId ?? "";
    if (protectedConnectionIds.has(connectionId)) {
      protectedJobsInSample += 1;
      continue;
    }
    if (disposableConnectionIds.has(connectionId)) {
      disposableJobsInSample += 1;
      continue;
    }
    reviewJobsInSample += 1;
    const ws = job.workspaceId ?? "unknown";
    reviewWorkspaceIds.set(ws, (reviewWorkspaceIds.get(ws) ?? 0) + 1);
  }

  const webhookPending = await prisma.jobQueue.count({
    where: {
      jobType: "microsoft_calendar_webhook_process",
      status: { in: ["pending", "deferred", "processing"] },
    },
  });

  const mctbP0pfConn = msConnections.filter((c) => isMctbPerfTestWorkspaceId(c.workspaceId)).length;

  console.log(
    JSON.stringify(
      {
        probedAt: new Date().toISOString(),
        connectionInventory: {
          microsoftSampled: msConnections.length,
          disposable: disposableConnectionIds.size,
          protected: protectedConnectionIds.size,
          manualReview: reviewConnectionIds.size,
          mctbP0pfInSample: mctbP0pfConn,
          arScaleTestWorkspaceIds: [...scaleTestWorkspaceIds],
        },
        jobQueue: {
          calendarConnectionSyncPendingTotal: pendingSyncTotal,
          sampleSize: sampleJobs.length,
          sampleDisposableJobs: disposableJobsInSample,
          sampleProtectedJobs: protectedJobsInSample,
          sampleReviewJobs: reviewJobsInSample,
          reviewWorkspaceCountsInSample: Object.fromEntries(
            [...reviewWorkspaceIds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20),
          ),
          webhookJobsNeverDeletedByCalendarCleanup: webhookPending,
          protectedJobTypesNote: [...PROTECTED_JOB_TYPES],
        },
        cleanupPolicy: {
          disposableConnectionRule:
            "sim-ms-conn-* / sim-ms-renew-*, workspace mctb_p0pf_*, AR scale test workspace, name Sim Microsoft *",
          protectedRule:
            "CALENDAR_CLEANUP_PROTECT_WORKSPACE_IDS (default ws_1), connected + credentialsRef",
          reviewRequired:
            "Jobs in sample not matching disposable or protected — classify before batch delete",
        },
        operationalNote:
          "This script does not enumerate all 693k jobs (PostgREST limits). Production cleanup must batch by connectionId/workspaceId using exported ID lists after review.",
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
