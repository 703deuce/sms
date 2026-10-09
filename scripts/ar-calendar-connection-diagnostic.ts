/**
 * Compare calendar connection signals across AR APIs for one workspace.
 * WORKSPACE_ID=ws_1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-calendar-connection-diagnostic.ts
 */
import { getPrisma } from "@/lib/db";
import {
  isCalendarConnectionLinked,
  isCalendarConnectionUsable,
} from "@/lib/appointment-reminders/calendar-connection";
import {
  isArCalendarViewerReadyFromIntegrationRows,
  isArCalendarViewerReadyFromOverview,
} from "@/lib/appointment-reminders/calendar/ar-calendar-viewer-ready";
import { loadAppointmentRemindersOverview } from "@/lib/appointment-reminders/load-ar-overview";
import { loadAppointmentRemindersPage } from "@/lib/appointment-reminders/load-appointments-page";

async function main() {
  const ws = process.env.WORKSPACE_ID || "ws_1";
  const prisma = getPrisma();
  const connections = await prisma.voiceCalendarConnection.findMany({
    where: { workspaceId: ws },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\n=== voiceCalendarConnection (${ws}) ===\n`);
  if (!connections.length) {
    console.log("(no rows)");
  }
  for (const c of connections) {
    const cfg = (c.config || {}) as Record<string, unknown>;
    console.log(
      JSON.stringify(
        {
          id: c.id,
          provider: c.provider,
          status: c.status,
          name: c.name,
          lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
          importCalendarIds: cfg.importCalendarIds,
          writeCalendarId: cfg.writeCalendarId,
          calendarId: cfg.calendarId,
          email: cfg.email,
          isCalendarConnectionLinked: isCalendarConnectionLinked(c.status),
          isCalendarConnectionUsable: isCalendarConnectionUsable(c.status),
        },
        null,
        2,
      ),
    );
  }

  const overview = await loadAppointmentRemindersOverview(ws);
  const appts = await loadAppointmentRemindersPage(ws, {
    date: "upcoming",
    page: 1,
    pageSize: 5,
  });
  const integrationRows = connections.map((c) => ({
    provider: c.provider,
    status: c.status,
  }));

  console.log("\n=== What each surface uses ===\n");
  console.log(
    JSON.stringify(
      {
        appointmentsPage: {
          api: "GET /api/appointment-reminders/appointments",
          backend: "loadAppointmentRemindersPage → sync.connected",
          syncConnected: appts.sync.connected,
          rule: "any voiceCalendarConnection (google|microsoft) with isCalendarConnectionUsable(status)",
        },
        calendarConnectionsUi: {
          api: "GET /api/integrations/calendars",
          rule: "row.status === 'connected' OR 'needs_reauth' (microsoft/google)",
          integrationRowsReady: isArCalendarViewerReadyFromIntegrationRows(integrationRows),
        },
        calendarPage_beforeFix130498952: {
          api: "GET /api/appointment-reminders/overview",
          rule: "importCalendarCount > 0 AND usable status (too strict)",
          setupCalendarConnected: overview.setup?.calendarConnected,
          viewerReadyFromOverview: isArCalendarViewerReadyFromOverview({
            setup: overview.setup,
            calendars: overview.calendars,
          }),
        },
        overviewCalendars: overview.calendars,
        smsReschedule: {
          note: "Uses voiceCalendarConnection config (writeCalendarId / importCalendarIds) per appointment metadata.connectionId",
        },
        appointmentsInDbSample: appts.total,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
