/**
 * Sequential production RCA — avoids PostgREST parallel count failures; no $queryRaw.
 */
import { getPrisma } from "../src/lib/db";

const JOB = "calendar_connection_sync";

async function countSafe(label: string, fn: () => Promise<number>) {
  try {
    const n = await fn();
    return { label, ok: true, count: n };
  } catch (e) {
    return { label, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const prisma = getPrisma();
  const results: Record<string, unknown> = { probedAt: new Date().toISOString() };

  const counts = [];
  for (const item of [
    {
      label: "cal_sync_pending",
      fn: () =>
        prisma.jobQueue.count({
          where: { jobType: JOB, status: { in: ["pending", "deferred"] } },
        }),
    },
    {
      label: "cal_sync_processing",
      fn: () => prisma.jobQueue.count({ where: { jobType: JOB, status: "processing" } }),
    },
    {
      label: "ms_connections_total",
      fn: () => prisma.voiceCalendarConnection.count({ where: { provider: "microsoft" } }),
    },
    {
      label: "ms_connected",
      fn: () =>
        prisma.voiceCalendarConnection.count({
          where: { provider: "microsoft", status: "connected" },
        }),
    },
    {
      label: "ms_needs_reauth",
      fn: () =>
        prisma.voiceCalendarConnection.count({
          where: { provider: "microsoft", status: "needs_reauth" },
        }),
    },
    {
      label: "ms_disconnected",
      fn: () =>
        prisma.voiceCalendarConnection.count({
          where: { provider: "microsoft", status: "disconnected" },
        }),
    },
    {
      label: "ms_sim_workspace",
      fn: () =>
        prisma.voiceCalendarConnection.count({
          where: { provider: "microsoft", workspaceId: { startsWith: "sim-" } },
        }),
    },
    {
      label: "ms_mctb_p0pf_workspace",
      fn: () =>
        prisma.voiceCalendarConnection.count({
          where: { provider: "microsoft", workspaceId: { startsWith: "mctb_p0pf_" } },
        }),
    },
    {
      label: "ms_ws_1",
      fn: () =>
        prisma.voiceCalendarConnection.count({
          where: { provider: "microsoft", workspaceId: "ws_1" },
        }),
    },
    {
      label: "cal_sync_pending_sim_ws",
      fn: () =>
        prisma.jobQueue.count({
          where: {
            jobType: JOB,
            status: { in: ["pending", "deferred"] },
            workspaceId: { startsWith: "sim-" },
          },
        }),
    },
    {
      label: "cal_sync_pending_ws_1",
      fn: () =>
        prisma.jobQueue.count({
          where: {
            jobType: JOB,
            status: { in: ["pending", "deferred"] },
            workspaceId: "ws_1",
          },
        }),
    },
    {
      label: "cal_sync_pending_mctb_p0pf",
      fn: () =>
        prisma.jobQueue.count({
          where: {
            jobType: JOB,
            status: { in: ["pending", "deferred"] },
            workspaceId: { startsWith: "mctb_p0pf_" },
          },
        }),
    },
    {
      label: "webhook_pending",
      fn: () =>
        prisma.jobQueue.count({
          where: {
            jobType: "microsoft_calendar_webhook_process",
            status: { in: ["pending", "deferred"] },
          },
        }),
    },
    {
      label: "reconcile_created_7d",
      fn: () =>
        prisma.jobQueue.count({
          where: {
            jobType: "calendar_connections_reconcile",
            createdAt: { gte: new Date(Date.now() - 7 * 86400_000) },
          },
        }),
    },
    {
      label: "cal_sync_created_7d",
      fn: () =>
        prisma.jobQueue.count({
          where: { jobType: JOB, createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } },
        }),
    },
  ]) {
    counts.push(await countSafe(item.label, item.fn));
  }
  results.counts = counts;

  const oldest = await prisma.jobQueue.findFirst({
    where: { jobType: JOB, status: { in: ["pending", "deferred"] } },
    orderBy: { runAfter: "asc" },
    select: {
      runAfter: true,
      createdAt: true,
      workspaceId: true,
      priority: true,
      idempotencyKey: true,
    },
  });
  results.oldestPending = oldest;

  const sample = await prisma.jobQueue.findMany({
    where: { jobType: JOB, status: { in: ["pending", "deferred"] } },
    take: 5000,
    select: { payload: true, idempotencyKey: true, priority: true, createdAt: true },
  });
  const byConn = new Map<string, number>();
  let chaser = 0;
  let pri25 = 0;
  let pri15 = 0;
  for (const row of sample) {
    const cid = (row.payload as { connectionId?: string })?.connectionId ?? "missing";
    byConn.set(cid, (byConn.get(cid) ?? 0) + 1);
    if (row.idempotencyKey?.includes(":chaser")) chaser += 1;
    if (row.priority === 25) pri25 += 1;
    if (row.priority === 15) pri15 += 1;
  }
  const dupCounts = [...byConn.values()].sort((a, b) => b - a);
  results.sample5000 = {
    uniqueConnectionsInSample: byConn.size,
    chaserRows: chaser,
    priority25: pri25,
    priority15: pri15,
    maxJobsSameConnectionInSample: dupCounts[0] ?? 0,
    p50JobsPerConnectionInSample:
      dupCounts.length ? dupCounts[Math.floor(dupCounts.length * 0.5)] : null,
  };

  const connSample = await prisma.voiceCalendarConnection.findMany({
    where: { provider: "microsoft" },
    take: 20,
    orderBy: { createdAt: "desc" },
    select: { id: true, workspaceId: true, status: true, lastSyncAt: true, createdAt: true },
  });
  results.recentMicrosoftConnectionsSample = connSample;

  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
