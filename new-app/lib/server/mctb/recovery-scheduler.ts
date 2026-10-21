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
  const now = new Date();
  const due = await prisma.missedCallEvent.findMany({
    where: {
      status: "SCHEDULED",
      scheduledSmsAt: { lte: now },
      ...(input?.workspaceId ? { workspaceId: input.workspaceId } : {}),
    },
    orderBy: { scheduledSmsAt: "asc" },
    take: limit,
  });

  const results: Array<{ missedCallEventId: string; ok: boolean; reason?: string }> = [];
  for (const row of due) {
    const claimed = await prisma.missedCallEvent.updateMany({
      where: { id: row.id, status: "SCHEDULED" },
      data: { status: "SENDING" },
    });
    if (claimed.count === 0) {
      results.push({ missedCallEventId: row.id, ok: true, reason: "already_claimed" });
      continue;
    }
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

/** Entry for cron/worker — processes job_queue rows and SCHEDULED missed-call events. */
export async function runMctbRecoveryScheduler(input?: { workspaceId?: string; limit?: number }) {
  const { processDueMctbRecoveryJobs } = await import("@/lib/server/jobs/mctb-jobs");
  return processDueMctbRecoveryJobs({ limit: input?.limit });
}
