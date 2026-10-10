/**
 * Read-only production verification probe (migration, schema, AR job activity).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-microsoft-production-verification-probe.ts
 */
import { getPrisma } from "../src/lib/db";
import { getSupabaseAdmin } from "../src/lib/supabase/admin";

const AR_JOB_TYPES = [
  "calendar_connections_reconcile",
  "calendar_subscription_renew",
  "microsoft_calendar_webhook_process",
  "appointments_platform_reminder_scan",
  "ar_dispatch_reminder",
  "calendar_connection_sync",
] as const;

async function main() {
  const prisma = getPrisma();
  const now = new Date();

  let migrationRows: unknown = null;
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("_prisma_migrations")
      .select("migration_name, finished_at, applied_steps_count")
      .ilike("migration_name", "%20261009120000%")
      .order("finished_at", { ascending: false })
      .limit(3);
    migrationRows = error ? { error: error.message } : data;
  } catch (e) {
    migrationRows = {
      note: "Verify on production web container: npx prisma migrate status",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const scheduleRow = await prisma.voiceCalendarConnection.findFirst({
    where: { provider: "microsoft" },
    select: {
      id: true,
      workspaceId: true,
      nextSyncDueAt: true,
      syncBackoffUntil: true,
      subscriptionRenewDueAt: true,
      lastSyncAt: true,
      lastSyncSuccessAt: true,
    },
  });
  const scheduleProbe = scheduleRow
    ? {
        connectionId: scheduleRow.id,
        workspaceId: scheduleRow.workspaceId,
        nextSyncDueAt: scheduleRow.nextSyncDueAt?.toISOString() ?? null,
        syncBackoffUntil: scheduleRow.syncBackoffUntil?.toISOString() ?? null,
        subscriptionRenewDueAt: scheduleRow.subscriptionRenewDueAt?.toISOString() ?? null,
        lastSyncAt: scheduleRow.lastSyncAt?.toISOString() ?? null,
        lastSyncSuccessAt: scheduleRow.lastSyncSuccessAt?.toISOString() ?? null,
      }
    : null;

  let arTableExists = true;
  try {
    await prisma.arReminderDispatch.findFirst({ select: { id: true } });
  } catch {
    arTableExists = false;
  }

  const arJobs: Record<string, unknown> = {};
  for (const jobType of AR_JOB_TYPES) {
    const [recent, backlog, failed24h, completed24h] = await Promise.all([
      prisma.jobQueue.findFirst({
        where: { jobType },
        orderBy: { createdAt: "desc" },
        select: {
          status: true,
          createdAt: true,
          completedAt: true,
          lastError: true,
          queueName: true,
        },
      }),
      prisma.jobQueue.count({
        where: { jobType, status: { in: ["pending", "deferred", "processing"] } },
      }),
      prisma.jobQueue.count({
        where: {
          jobType,
          status: "failed",
          updatedAt: { gte: new Date(now.getTime() - 24 * 3600_000) },
        },
      }),
      prisma.jobQueue.count({
        where: {
          jobType,
          status: "completed",
          completedAt: { gte: new Date(now.getTime() - 24 * 3600_000) },
        },
      }),
    ]);
    arJobs[jobType] = { backlog, failed24h, completed24h, recent };
  }

  const [dispatchByStatus, msConnections] = await Promise.all([
    prisma.arReminderDispatch.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.voiceCalendarConnection.findMany({
      where: { provider: "microsoft", status: { in: ["connected", "needs_reauth"] } },
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        lastSyncAt: true,
        lastSyncSuccessAt: true,
        nextSyncDueAt: true,
        subscriptionRenewDueAt: true,
      },
    }),
  ]);

  const heartbeats = await prisma.workerHeartbeat.findMany({
    orderBy: { lastBeatAt: "desc" },
    take: 4,
    select: { workerKey: true, workerId: true, lastBeatAt: true },
  });

  const maintenanceReconcileIdempotency = await prisma.jobQueue.findMany({
    where: {
      jobType: "calendar_connections_reconcile",
      createdAt: { gte: new Date(now.getTime() - 15 * 60_000) },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, status: true, createdAt: true, idempotencyKey: true },
  });

  console.log(
    JSON.stringify(
      {
        probedAt: now.toISOString(),
        migration: migrationRows,
        voiceCalendarConnectionScheduleColumnsSample: scheduleProbe,
        arReminderDispatchesTable: arTableExists,
        arReminderDispatchStatusTotals: dispatchByStatus,
        arJobActivity: arJobs,
        sampleMicrosoftConnections: msConnections,
        workerHeartbeats: heartbeats.map((h) => ({
          ...h,
          ageSeconds: Math.round((now.getTime() - h.lastBeatAt.getTime()) / 1000),
        })),
        recentMaintenanceReconcileJobs: maintenanceReconcileIdempotency,
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
