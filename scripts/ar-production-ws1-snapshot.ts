/**
 * One-off production snapshot for ws_1 Microsoft + job queue (read-only).
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-production-ws1-snapshot.ts
 */
import { getPrisma } from "../src/lib/db";
import {
  arPlanLimitsForWorkspace,
  resolveArWorkspaceCommercial,
} from "../src/lib/appointment-reminders/commercial/ar-workspace-plan";
import type { CalendarConfig } from "../src/lib/calendar/providers";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";

async function main() {
  const prisma = getPrisma();
  const commercial = await resolveArWorkspaceCommercial(WORKSPACE_ID);
  const limits = arPlanLimitsForWorkspace(commercial);

  const connections = await prisma.voiceCalendarConnection.findMany({
    where: { workspaceId: WORKSPACE_ID, provider: "microsoft" },
    select: {
      id: true,
      status: true,
      config: true,
      lastSyncAt: true,
      lastSyncSuccessAt: true,
      nextSyncDueAt: true,
      subscriptionRenewDueAt: true,
    },
  });

  const connSummary = connections.map((c) => {
    const cfg = (c.config || {}) as CalendarConfig;
    return {
      id: c.id,
      status: c.status,
      importCalendarIds: cfg.importCalendarIds,
      microsoftSubscription: cfg.microsoftSubscription,
      microsoftCalendarSubscriptions: cfg.microsoftCalendarSubscriptions,
      lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
      lastSyncSuccessAt: c.lastSyncSuccessAt?.toISOString() ?? null,
      nextSyncDueAt: c.nextSyncDueAt?.toISOString() ?? null,
      subscriptionRenewDueAt: c.subscriptionRenewDueAt?.toISOString() ?? null,
    };
  });

  const since = new Date(Date.now() - 7 * 24 * 3600_000);
  const [webhooks, syncs, recentAppt] = await Promise.all([
    prisma.jobQueue.findMany({
      where: {
        workspaceId: WORKSPACE_ID,
        jobType: "microsoft_calendar_webhook_process",
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        status: true,
        createdAt: true,
        completedAt: true,
        lastError: true,
        attempts: true,
      },
    }),
    prisma.jobQueue.findMany({
      where: {
        workspaceId: WORKSPACE_ID,
        jobType: "calendar_connection_sync",
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        status: true,
        createdAt: true,
        completedAt: true,
        lastError: true,
      },
    }),
    prisma.voiceAppointment.findFirst({
      where: {
        workspaceId: WORKSPACE_ID,
        serviceName: { contains: "Tony", mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        serviceName: true,
        startsAt: true,
        updatedAt: true,
        metadata: true,
      },
    }),
  ]);

  const pendingMsWebhook = await prisma.jobQueue.count({
    where: {
      workspaceId: WORKSPACE_ID,
      jobType: "microsoft_calendar_webhook_process",
      status: "pending",
    },
  });

  console.log(
    JSON.stringify(
      {
        workspaceId: WORKSPACE_ID,
        commercial: {
          planKey: commercial.planKey,
          stripeStatus: commercial.stripeStatus,
          reminderStepsMax: limits.reminderStepsMax,
        },
        microsoftConnections: connSummary,
        pendingMicrosoftWebhookJobs: pendingMsWebhook,
        recentMicrosoftWebhookJobs: webhooks,
        recentCalendarSyncJobs: syncs,
        sampleTonyAppointment: recentAppt
          ? {
              id: recentAppt.id,
              serviceName: recentAppt.serviceName,
              startsAt: recentAppt.startsAt.toISOString(),
              inviteePhone: (recentAppt.metadata as Record<string, unknown>)?.inviteePhone,
              remindersSent: (recentAppt.metadata as Record<string, unknown>)?.remindersSent,
            }
          : null,
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
