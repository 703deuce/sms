/**
 * Lightweight RCA queries (counts only) — works around PostgREST row limits on groupBy.
 */
import { getPrisma } from "../src/lib/db";

const JOB = "calendar_connection_sync";

async function main() {
  const prisma = getPrisma();
  const now = new Date();

  const pending = await prisma.jobQueue.count({
    where: { jobType: JOB, status: { in: ["pending", "deferred"] } },
  });

  const oldest = await prisma.jobQueue.findFirst({
    where: { jobType: JOB, status: { in: ["pending", "deferred"] } },
    orderBy: { runAfter: "asc" },
    select: { runAfter: true, createdAt: true, workspaceId: true, priority: true },
  });

  const newestPending = await prisma.jobQueue.findFirst({
    where: { jobType: JOB, status: { in: ["pending", "deferred"] } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const msConn = await prisma.voiceCalendarConnection.count({ where: { provider: "microsoft" } });
  const msConnected = await prisma.voiceCalendarConnection.count({
    where: { provider: "microsoft", status: "connected" },
  });
  const msNeedsReauth = await prisma.voiceCalendarConnection.count({
    where: { provider: "microsoft", status: "needs_reauth" },
  });
  const msDisconnected = await prisma.voiceCalendarConnection.count({
    where: { provider: "microsoft", status: "disconnected" },
  });

  const simConn = await prisma.voiceCalendarConnection.count({
    where: {
      provider: "microsoft",
      OR: [{ workspaceId: { startsWith: "sim-" } }, { workspaceId: { startsWith: "mctb_p0pf_" } }],
    },
  });

  const webhookPending = await prisma.jobQueue.count({
    where: {
      jobType: "microsoft_calendar_webhook_process",
      status: { in: ["pending", "deferred"] },
    },
  });

  const reconcilePending = await prisma.jobQueue.count({
    where: {
      jobType: "calendar_connections_reconcile",
      status: { in: ["pending", "deferred", "processing"] },
    },
  });

  const defaultPending = await prisma.jobQueue.count({
    where: { queueName: "default", status: { in: ["pending", "deferred"] } },
  });

  const maintenancePending = await prisma.jobQueue.count({
    where: { queueName: "maintenance", status: { in: ["pending", "deferred"] } },
  });

  const jobTypeSample = await prisma.jobQueue.groupBy({
    by: ["jobType"],
    where: { queueName: "default", status: { in: ["pending", "deferred"] } },
    _count: { _all: true },
    orderBy: { _count: { jobType: "desc" } },
    take: 15,
  });

  console.log(
    JSON.stringify(
      {
        probedAt: now.toISOString(),
        calendarSync: { pending, oldest, newestPendingCreatedAt: newestPending?.createdAt },
        microsoftConnections: {
          total: msConn,
          connected: msConnected,
          needsReauth: msNeedsReauth,
          disconnected: msDisconnected,
          simOrMctbLoadPrefix: simConn,
        },
        otherBacklog: {
          webhookPending,
          reconcilePending,
          defaultQueuePending: defaultPending,
          maintenanceQueuePending: maintenancePending,
        },
        defaultQueuePendingByJobTypeTop15: jobTypeSample,
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
