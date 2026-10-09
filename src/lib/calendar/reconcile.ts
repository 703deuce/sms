import "server-only";

import { shouldImportFromConnection } from "@/lib/calendar/eligibility";
import { enqueueCalendarConnectionSync } from "@/lib/calendar/import-sync";
import { discoverAndEnqueueMicrosoftCalendarSyncs } from "@/lib/calendar/microsoft-reconcile-discovery";
import type { CalendarConfig } from "@/lib/calendar/providers";
import { getPrisma } from "@/lib/db";

/** Fallback reconciliation when push notifications are missed. */
export async function reconcileWorkspaceCalendarConnections(input?: {
  workspaceId?: string;
  limit?: number;
}) {
  const microsoft = await discoverAndEnqueueMicrosoftCalendarSyncs({
    workspaceId: input?.workspaceId,
    budget: input?.limit,
  });

  const prisma = getPrisma();
  const googleLimit = input?.limit ?? 100;
  const connections = await prisma.voiceCalendarConnection.findMany({
    where: {
      provider: "google",
      status: { in: ["connected", "needs_reauth"] },
      ...(input?.workspaceId ? { workspaceId: input.workspaceId } : {}),
    },
    orderBy: { lastSyncAt: "asc" },
    take: googleLimit,
  });

  let googleQueued = 0;
  for (const conn of connections) {
    const config = (conn.config || {}) as CalendarConfig;
    if (!shouldImportFromConnection(config)) continue;

    const stale =
      !conn.lastSyncAt ||
      conn.lastSyncAt.getTime() < Date.now() - 15 * 60_000;

    if (!stale) continue;

    await enqueueCalendarConnectionSync(conn.workspaceId, conn.id, true);
    googleQueued += 1;
  }

  return {
    scanned: microsoft.dueDiscovered + connections.length,
    queued: microsoft.enqueued + googleQueued,
    microsoft,
    googleQueued,
  };
}
