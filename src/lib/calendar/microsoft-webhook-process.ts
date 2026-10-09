import "server-only";

import { enqueueCalendarConnectionSync, syncCalendarProviderEventById } from "@/lib/calendar/import-sync";
import { resolveImportCalendarIds, type CalendarConfig } from "@/lib/calendar/providers";
import { getPrisma } from "@/lib/db";

const WEBHOOK_CALENDAR_SYNC_PRIORITY = 15;

export async function processMicrosoftCalendarWebhookJob(payload: {
  workspaceId: string;
  connectionId: string;
  providerEventId?: string | null;
  changeType?: string | null;
}) {
  const workspaceId = String(payload.workspaceId || "");
  const connectionId = String(payload.connectionId || "");
  if (!workspaceId || !connectionId) {
    return { ok: false, reason: "missing_ids" };
  }

  const conn = await getPrisma().voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId, provider: "microsoft" },
  });
  if (!conn) return { ok: false, reason: "connection_not_found" };

  const config = (conn.config || {}) as CalendarConfig;
  const providerEventId = payload.providerEventId ? String(payload.providerEventId) : null;

  if (providerEventId) {
    const calendarIds = resolveImportCalendarIds(config);
    try {
      await syncCalendarProviderEventById({
        workspaceId,
        connectionId,
        provider: "microsoft",
        eventId: providerEventId,
        calendarId: calendarIds[0],
      });
    } catch (err) {
      console.warn(
        "[calendar] microsoft webhook targeted sync failed",
        connectionId,
        providerEventId,
        err,
      );
    }
  }

  await enqueueCalendarConnectionSync(workspaceId, connectionId, true, {
    priority: WEBHOOK_CALENDAR_SYNC_PRIORITY,
    wake: true,
  });

  return { ok: true };
}
