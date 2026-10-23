import { getPrisma } from "@/lib/server/db";
import { readAttemptMetadata } from "./attempt-metadata";
import {
  DEFAULT_ABANDONMENT_POLICY,
  evaluateAbandonmentSafeguards,
  computeAbandonRate,
} from "./abandonment-policy";

/** M59 — campaign abandoned-call ratio from attempt metadata (parallel/predictive). */
export async function getCampaignAbandonedMetrics(
  workspaceId: string,
  campaignId: string,
  windowDays = 30,
) {
  const prisma = getPrisma();
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const campaign = await prisma.powerDialerCampaign.findFirst({
    where: { id: campaignId, workspaceId },
    select: { configJson: true, name: true },
  });
  const attempts = await prisma.powerDialerAttempt.findMany({
    where: {
      workspaceId,
      createdAt: { gte: since },
      session: { campaignId },
      status: { in: ["answered", "no_answer", "voicemail", "failed", "completed", "cancelled"] },
    },
    select: { id: true, metadataJson: true, disposition: true },
  });
  let connected = 0;
  let abandoned = 0;
  for (const a of attempts) {
    const meta = readAttemptMetadata(a.metadataJson);
    if (meta.abandonedCall) abandoned += 1;
    else if (!meta.parallelLoser) connected += 1;
  }
  const total = connected + abandoned;
  const rate = computeAbandonRate({ abandonedCount: abandoned, connectedCount: connected });
  const safeguards = evaluateAbandonmentSafeguards(DEFAULT_ABANDONMENT_POLICY, {
    abandonedCount: abandoned,
    connectedCount: connected,
  });
  const jurisdictionPreset =
    campaign?.configJson && typeof campaign.configJson === "object"
      ? String((campaign.configJson as { jurisdictionPreset?: string }).jurisdictionPreset || "none")
      : "none";
  return {
    windowDays,
    reportingPeriodDays: DEFAULT_ABANDONMENT_POLICY.reportingWindowDays,
    jurisdictionPreset,
    totalAttempts: total,
    abandonedCount: abandoned,
    connectedCount: connected,
    abandonedRatePct: rate,
    safeguardThresholdPct: DEFAULT_ABANDONMENT_POLICY.targetAbandonRatePct,
    autoThrottleActive: safeguards.autoThrottle,
    hardStopActive: safeguards.hardStop,
    pacingMultiplier: safeguards.pacingMultiplier,
    note:
      rate == null
        ? "No terminal parallel/predictive attempts in this window yet."
        : "Rates use metadata.abandonedCall on answered legs without a timely rep bridge. Jurisdiction-specific reporting may require longer windows than 30 days.",
  };
}
