import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { isCalendarConnectionUsable } from "@/lib/appointment-reminders/calendar-connection";
import { getPrisma } from "@/lib/db";
import { syncWorkspaceCalendarConnection } from "@/lib/calendar/import-sync";

export async function POST() {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.calendar");
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();
    const allConnections = await prisma.voiceCalendarConnection.findMany({
      where: {
        workspaceId: auth.workspaceId,
        provider: { in: ["google", "microsoft"] },
      },
      select: { id: true, status: true, config: true },
    });
    const connections = allConnections.filter((c) => isCalendarConnectionUsable(c.status));
    if (!connections.length) {
      return NextResponse.json({ error: "No calendar connected" }, { status: 400 });
    }
    const results = [];
    let anyImported = false;
    for (const conn of connections) {
      const config = (conn.config || {}) as { importCalendarIds?: string[] };
      if (!config.importCalendarIds?.length) {
        results.push({
          connectionId: conn.id,
          stats: { imported: 0, updated: 0, canceled: 0, skipped: 0, errors: 0 },
          skippedReason:
            "No calendars selected for appointment import. Open Calendars, choose which Outlook/Google calendars to import, then save.",
        });
        continue;
      }
      const stats = await syncWorkspaceCalendarConnection(auth.workspaceId, conn.id, {
        incremental: true,
        manual: true,
      });
      anyImported = anyImported || stats.imported + stats.updated > 0;
      results.push({ connectionId: conn.id, stats });
    }
    return NextResponse.json({ data: { results, anyImported } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
