import "server-only";

import { shouldImportFromConnection } from "@/lib/calendar/eligibility";
import type { CalendarConfig } from "@/lib/calendar/providers";
import { enqueueCalendarConnectionSync } from "@/lib/calendar/import-sync";
import {
  markMicrosoftSyncEnqueueLease,
  type MicrosoftSyncScheduleMetrics,
} from "@/lib/calendar/microsoft-connection-schedule";
import {
  microsoftCalendarReconcileIntervalMinutes,
  microsoftReconcileDiscoveryBudgetPerTick,
} from "@/lib/calendar/microsoft-schedule-config";
import { getPrisma } from "@/lib/db";

/**
 * Discover Microsoft connections due for scheduled sync and enqueue bounded work.
 * Uses keyset pagination on (nextSyncDueAt, id) — no OFFSET over a moving set.
 */
export async function discoverAndEnqueueMicrosoftCalendarSyncs(input?: {
  budget?: number;
  workspaceId?: string;
  /** When true, count due connections without enqueueing jobs (scale tests). */
  dryRun?: boolean;
}): Promise<MicrosoftSyncScheduleMetrics & { intervalMinutes: number }> {
  const prisma = getPrisma();
  const budget = input?.budget ?? microsoftReconcileDiscoveryBudgetPerTick();
  const now = new Date();
  const metrics: MicrosoftSyncScheduleMetrics = {
    dueDiscovered: 0,
    enqueued: 0,
    skippedBackoff: 0,
    skippedLease: 0,
  };

  let cursorDueAt: Date | null = null;
  let cursorId: string | null = null;
  const claimedIds: string[] = [];

  while (metrics.enqueued < budget) {
    const take = Math.min(100, budget - metrics.enqueued);
    const batch = await prisma.voiceCalendarConnection.findMany({
      where: {
        provider: "microsoft",
        status: { in: ["connected", "needs_reauth"] },
        ...(input?.workspaceId ? { workspaceId: input.workspaceId } : {}),
        OR: [
          { nextSyncDueAt: null },
          { nextSyncDueAt: { lte: now } },
        ],
        AND: [
          {
            OR: [{ syncBackoffUntil: null }, { syncBackoffUntil: { lte: now } }],
          },
          cursorDueAt && cursorId
            ? {
                OR: [
                  { nextSyncDueAt: { gt: cursorDueAt } },
                  { nextSyncDueAt: cursorDueAt, id: { gt: cursorId } },
                  { nextSyncDueAt: null, id: { gt: cursorId } },
                ],
              }
            : {},
        ],
      },
      orderBy: [{ nextSyncDueAt: "asc" }, { id: "asc" }],
      take,
      select: { id: true, workspaceId: true, config: true, nextSyncDueAt: true, syncBackoffUntil: true },
    });

    if (!batch.length) break;

    for (const conn of batch) {
      metrics.dueDiscovered += 1;
      const config = (conn.config || {}) as CalendarConfig;
      if (!shouldImportFromConnection(config)) continue;

      if (conn.syncBackoffUntil && conn.syncBackoffUntil > now) {
        metrics.skippedBackoff += 1;
        continue;
      }

      // Legacy: connections without nextSyncDueAt but recently synced — skip until interval elapsed
      if (!conn.nextSyncDueAt && conn.nextSyncDueAt === null) {
        // handled by OR branch; null nextSyncDueAt is always due for initialization
      }

      if (!input?.dryRun) {
        await enqueueCalendarConnectionSync(conn.workspaceId, conn.id, true, {
          priority: 25,
          wake: true,
        });
      }
      claimedIds.push(conn.id);
      metrics.enqueued += 1;
    }

    const last = batch[batch.length - 1];
    cursorDueAt = last.nextSyncDueAt ?? new Date(0);
    cursorId = last.id;
    if (batch.length < take) break;
  }

  if (claimedIds.length && !input?.dryRun) {
    await markMicrosoftSyncEnqueueLease(claimedIds);
  }

  return { ...metrics, intervalMinutes: microsoftCalendarReconcileIntervalMinutes() };
}
