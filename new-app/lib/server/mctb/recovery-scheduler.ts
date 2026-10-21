import "server-only";

import { getPrisma } from "@/lib/server/db";
import { executeMctbRecoverySend } from "@/lib/server/mctb/send-recovery";

/**
 * Durable delayed MCTB sends — poll SCHEDULED rows (no in-process setTimeout).
 * Wire to cron/worker when BullMQ is enabled in new-app.
 */
export async function processDueMctbRecoverySends(input?: { workspaceId?: string; limit?: number }) {
  const prisma = getPrisma();
  const limit = input?.limit ?? 50;
  const due = await prisma.missedCallEvent.findMany({
    where: {
      status: "SCHEDULED",
      scheduledSmsAt: { lte: new Date() },
      ...(input?.workspaceId ? { workspaceId: input.workspaceId } : {}),
    },
    orderBy: { scheduledSmsAt: "asc" },
    take: limit,
  });

  const results: Array<{ missedCallEventId: string; ok: boolean; reason?: string }> = [];
  for (const row of due) {
    const sent = await executeMctbRecoverySend({
      workspaceId: row.workspaceId,
      missedCallEventId: row.id,
    });
    results.push({
      missedCallEventId: row.id,
      ok: sent.ok,
      reason: sent.reason,
    });
  }
  return { processed: results.length, results };
}
