import "server-only";

import { isCalendarConnectionUsable } from "@/lib/appointment-reminders/calendar-connection";
import { syncWorkspaceCalendarConnection } from "@/lib/calendar/import-sync";
import { ensureMicrosoftCalendarSubscription } from "@/lib/calendar/webhooks";
import type { CalendarConfig } from "@/lib/calendar/providers";
import { getPrisma } from "@/lib/db";

const STALE_MS = 15 * 60 * 1000;

/** Incremental import when connection sync is stale (webhooks + reconciliation backstop). */
export async function maybeSyncStaleAppointmentRemindersCalendars(workspaceId: string): Promise<{
  ran: boolean;
  results: Array<{ connectionId: string; stats?: unknown; error?: string }>;
}> {
  const prisma = getPrisma();
  const connections = await prisma.voiceCalendarConnection.findMany({
    where: {
      workspaceId,
      provider: { in: ["google", "microsoft"] },
    },
    select: { id: true, provider: true, status: true, lastSyncAt: true, config: true },
  });
  type ConnRow = (typeof connections)[number];
  const usable = connections.filter((c: ConnRow) => isCalendarConnectionUsable(c.status));
  const stale = usable.filter(
    (c: ConnRow) => !c.lastSyncAt || Date.now() - c.lastSyncAt.getTime() > STALE_MS,
  );
  if (!stale.length) return { ran: false, results: [] };

  const results: Array<{ connectionId: string; stats?: unknown; error?: string }> = [];
  for (const conn of stale) {
    const config = (conn.config || {}) as { importCalendarIds?: string[] };
    if (!config.importCalendarIds?.length) {
      results.push({ connectionId: conn.id, error: "no_import_calendars" });
      continue;
    }
    try {
      const fullConfig = (conn.config || {}) as CalendarConfig;
      if (conn.provider === "microsoft" && fullConfig.syncEnabled && !fullConfig.microsoftSubscription?.id) {
        await ensureMicrosoftCalendarSubscription(workspaceId, conn.id).catch(() => undefined);
      }
      const stats = await syncWorkspaceCalendarConnection(workspaceId, conn.id, {
        incremental: true,
        manual: false,
      });
      results.push({ connectionId: conn.id, stats });
    } catch (err) {
      results.push({
        connectionId: conn.id,
        error: err instanceof Error ? err.message : "sync_failed",
      });
    }
  }
  return { ran: true, results };
}
