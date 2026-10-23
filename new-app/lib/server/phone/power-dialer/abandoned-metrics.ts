import { getPrisma } from "@/lib/server/db";

/** M59 — campaign abandoned-call ratio from terminal attempt outcomes (honest when no parallel dialer). */
export async function getCampaignAbandonedMetrics(
  workspaceId: string,
  campaignId: string,
  windowDays = 30,
) {
  const prisma = getPrisma();
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const attempts = await prisma.powerDialerAttempt.findMany({
    where: {
      workspaceId,
      createdAt: { gte: since },
      session: { campaignId },
      status: { in: ["answered", "no_answer", "voicemail", "failed", "completed"] },
    },
    select: { id: true, metadata: true, disposition: true },
  });
  let live = 0;
  let abandoned = 0;
  for (const a of attempts) {
    const meta = (a.metadata || {}) as { abandonedCall?: boolean; parallelLoser?: boolean };
    if (meta.abandonedCall) abandoned += 1;
    else live += 1;
  }
  const total = live + abandoned;
  const rate = total > 0 ? Math.round((abandoned / total) * 1000) / 10 : null;
  return {
    windowDays,
    totalAttempts: total,
    abandonedCount: abandoned,
    abandonedRatePct: rate,
    safeguardThresholdPct: 3,
    note:
      "Abandoned counts require parallel/predictive modes to mark metadata.abandonedCall. Power mode shows 0% until those modes are active.",
  };
}
