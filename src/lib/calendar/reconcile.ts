import "server-only";

import { shouldImportFromConnection } from "@/lib/calendar/eligibility";
import { enqueueCalendarConnectionSync } from "@/lib/calendar/import-sync";
import type { CalendarConfig } from "@/lib/calendar/providers";
import { getPrisma } from "@/lib/db";

/** Fallback reconciliation when push notifications are missed. */
export async function reconcileWorkspaceCalendarConnections(input?: {
  workspaceId?: string;
  limit?: number;
}) {
  const prisma = getPrisma();
  const connections = await prisma.voiceCalendarConnection.findMany({
    where: {
      provider: { in: ["google", "microsoft"] },
      status: { in: ["connected", "needs_reauth"] },
      ...(input?.workspaceId ? { workspaceId: input.workspaceId } : {}),
    },
    orderBy: { lastSyncAt: "asc" },
    take: input?.limit ?? 100,
  });

  let queued = 0;
  for (const conn of connections) {
    const config = (conn.config || {}) as CalendarConfig;
    if (!shouldImportFromConnection(config)) continue;

    const stale =
      !conn.lastSyncAt ||
      conn.lastSyncAt.getTime() < Date.now() - 15 * 60_000;

    if (!stale) continue;

    await enqueueCalendarConnectionSync(conn.workspaceId, conn.id, true);
    queued += 1;
  }

  return { scanned: connections.length, queued };
}
