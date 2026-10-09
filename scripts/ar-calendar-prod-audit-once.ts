/**
 * One-off production audit: webhooks, sync config, recent imports.
 * WORKSPACE_ID=ws_1 npx tsx scripts/ar-calendar-prod-audit-once.ts
 */
import { getPrisma } from "@/lib/db";

async function main() {
  const ws = process.env.WORKSPACE_ID || "ws_1";
  const hours = Number(process.env.HOURS || "6");
  const since = new Date(Date.now() - hours * 3600_000);
  const prisma = getPrisma();

  const webhooks = await prisma.providerWebhookEvent.findMany({
    where: { workspaceId: ws, eventType: "calendar_change", createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { createdAt: true, providerEventId: true, provider: true, payload: true },
  });
  console.log(`\n=== calendar_change webhooks (last ${hours}h) count=${webhooks.length} ===`);
  for (const w of webhooks) {
    const p = (w.payload || {}) as Record<string, unknown>;
    console.log(
      w.createdAt.toISOString(),
      String(p.changeType || "?"),
      String(w.providerEventId).slice(0, 72),
    );
  }

  const connections = await prisma.voiceCalendarConnection.findMany({
    where: { workspaceId: ws, provider: { in: ["microsoft", "google"] } },
  });
  console.log("\n=== Microsoft/Google connections ===");
  for (const c of connections) {
    const cfg = (c.config || {}) as Record<string, unknown>;
    console.log(
      JSON.stringify(
        {
          id: c.id,
          status: c.status,
          lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
          syncEnabled: cfg.syncEnabled,
          importCalendarIdsCount: Array.isArray(cfg.importCalendarIds)
            ? cfg.importCalendarIds.length
            : 0,
          microsoftSubscription: cfg.microsoftSubscription
            ? {
                id: (cfg.microsoftSubscription as { id?: string }).id?.slice(0, 12),
                expiresAt: (cfg.microsoftSubscription as { expiresAt?: string }).expiresAt,
              }
            : null,
          lastSyncError: cfg.lastSyncError,
        },
        null,
        2,
      ),
    );
  }

  const jobs = await prisma.jobQueue.findMany({
    where: {
      jobType: "calendar_connection_sync",
      createdAt: { gte: since },
      payload: { path: ["workspaceId"], equals: ws },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      createdAt: true,
      status: true,
      lastError: true,
      payload: true,
      completedAt: true,
    },
  });
  console.log(`\n=== calendar_connection_sync jobs (last ${hours}h) count=${jobs.length} ===`);
  for (const j of jobs) {
    const p = j.payload as { connectionId?: string; incremental?: boolean };
    console.log(
      j.createdAt.toISOString(),
      j.status,
      p.connectionId?.slice(0, 12),
      j.lastError?.slice(0, 80) || "",
    );
  }

  const appts = await prisma.voiceAppointment.findMany({
    where: { workspaceId: ws, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      createdAt: true,
      startsAt: true,
      serviceName: true,
      status: true,
      externalId: true,
      metadata: true,
    },
  });
  console.log(`\n=== voiceAppointment created (last ${hours}h) count=${appts.length} ===`);
  for (const a of appts) {
    const meta = (a.metadata || {}) as { source?: string; providerEventId?: string };
    console.log(
      a.createdAt.toISOString(),
      "start",
      a.startsAt.toISOString(),
      a.serviceName,
      meta.source,
      meta.providerEventId?.slice(0, 24),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
