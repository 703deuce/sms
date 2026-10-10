import "server-only";

import { isCalendarConnectionUsable } from "@/lib/appointment-reminders/calendar-connection";
import { syncWorkspaceCalendarConnection } from "@/lib/calendar/import-sync";
import { ensureMicrosoftCalendarSubscriptionsForWorkspace } from "@/lib/calendar/ensure-microsoft-subscriptions";
import { getPrisma } from "@/lib/db";

const STALE_MS = 15 * 60 * 1000;

type ConnRow = {
  id: string;
  status: string;
  lastSyncAt: Date | null;
  config: unknown;
};

function importCalendarIds(config: unknown): string[] {
  const cfg = (config || {}) as { importCalendarIds?: string[]; syncEnabled?: boolean };
  if (cfg.syncEnabled === false) return [];
  return cfg.importCalendarIds ?? [];
}

/**
 * Keep AR calendar data fresh: full import when never synced, incremental when stale.
 * `awaitInitial` blocks until first full import finishes (setup / activation).
 */
export async function ensureAppointmentRemindersCalendarsSynced(
  workspaceId: string,
  options?: { awaitInitial?: boolean },
): Promise<{ ran: boolean; results: Array<{ connectionId: string; stats?: unknown; error?: string }> }> {
  const prisma = getPrisma();
  const connections = await prisma.voiceCalendarConnection.findMany({
    where: {
      workspaceId,
      provider: { in: ["google", "microsoft"] },
    },
    select: { id: true, status: true, lastSyncAt: true, config: true },
  });

  const usable = connections.filter((c: ConnRow) => isCalendarConnectionUsable(c.status));
  const withImports = usable.filter((c: ConnRow) => importCalendarIds(c.config).length > 0);
  if (!withImports.length) return { ran: false, results: [] };

  const neverSynced = withImports.filter((c: ConnRow) => !c.lastSyncAt);
  const staleOnly = withImports.filter(
    (c: ConnRow) =>
      c.lastSyncAt && Date.now() - c.lastSyncAt.getTime() > STALE_MS,
  );

  const toSync = options?.awaitInitial
    ? [...neverSynced, ...staleOnly.filter((c) => !neverSynced.some((n) => n.id === c.id))]
    : [...neverSynced, ...staleOnly];

  if (!toSync.length) return { ran: false, results: [] };

  await ensureMicrosoftCalendarSubscriptionsForWorkspace(workspaceId).catch(() => undefined);

  const results: Array<{ connectionId: string; stats?: unknown; error?: string }> = [];
  for (const conn of toSync) {
    const incremental = Boolean(conn.lastSyncAt);
    try {
      const stats = await syncWorkspaceCalendarConnection(workspaceId, conn.id, {
        incremental,
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

/** Fire-and-forget stale / first sync (page loads). */
export function scheduleAppointmentRemindersCalendarSync(workspaceId: string): void {
  void ensureAppointmentRemindersCalendarsSynced(workspaceId).catch(() => undefined);
}
