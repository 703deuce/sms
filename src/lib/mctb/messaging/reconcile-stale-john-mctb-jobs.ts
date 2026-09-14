import { getPrisma } from "@/lib/db";
import { completeJob } from "@/lib/messaging/enqueue-advance";

/**
 * Resolve pending john_mctb_send rows whose missed-call opener is no longer appropriate.
 * Does not send SMS — marks job completed and event suppressed when stale.
 */
export async function reconcileStaleJohnMctbSendJobs(limit = 25) {
  const prisma = getPrisma();
  const openerMaxAgeMs = Number(process.env.MCTB_OPENER_MAX_AGE_MS || 72 * 60 * 60 * 1000);
  const cutoff = new Date(Date.now() - openerMaxAgeMs);

  const pending = await prisma.jobQueue.findMany({
    where: {
      jobType: "john_mctb_send",
      status: { in: ["pending", "deferred"] },
      createdAt: { lt: cutoff },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let resolved = 0;
  for (const job of pending) {
    const payload = (job.payload || {}) as Record<string, unknown>;
    const missedCallEventId = String(payload.missedCallEventId || "");
    const workspaceId = String(payload.workspaceId || job.workspaceId || "");
    if (!missedCallEventId) continue;

    const event = await prisma.missedCallEvent.findFirst({
      where: { id: missedCallEventId, ...(workspaceId ? { workspaceId } : {}) },
      select: { id: true, smsSentAt: true, status: true, createdAt: true },
    });

    if (!event) {
      await completeJob(job.id);
      resolved += 1;
      continue;
    }

    if (event.smsSentAt || event.status === "SENT") {
      await completeJob(job.id);
      resolved += 1;
      continue;
    }

    if (event.createdAt.getTime() < cutoff.getTime()) {
      await prisma.missedCallEvent.update({
        where: { id: event.id },
        data: {
          status: "SUPPRESSED",
          suppressionReason: "STALE_OPENER_EXPIRED",
          eligible: false,
        },
      });
      await completeJob(job.id);
      resolved += 1;
    }
  }

  return { examined: pending.length, resolved };
}
