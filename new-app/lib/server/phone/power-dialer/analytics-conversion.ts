import { getPrisma } from "@/lib/server/db";
import { parseExtendedConfig } from "./campaign-extended-config";

/** M64 — conversions from disposition definitions (markContactCompleted or outcomeClass success). */
export async function getCampaignConversionSummary(
  workspaceId: string,
  rangeFrom: Date,
  repUserIdFilter?: string | null,
) {
  const prisma = getPrisma();
  const attempts = await prisma.powerDialerAttempt.findMany({
    where: {
      workspaceId,
      createdAt: { gte: rangeFrom },
      dispositionId: { not: null },
      ...(repUserIdFilter ? { session: { repUserId: repUserIdFilter } } : {}),
    },
    select: {
      dispositionId: true,
      dispositionDef: {
        select: { markContactCompleted: true, outcomeClass: true, label: true },
      },
      session: { select: { campaignId: true } },
    },
  });

  const byCampaign = new Map<string, { conversions: number; total: number }>();
  for (const a of attempts) {
    const cid = a.session.campaignId;
    const bucket = byCampaign.get(cid) || { conversions: 0, total: 0 };
    bucket.total += 1;
    const def = a.dispositionDef;
    const isSuccess =
      def?.markContactCompleted ||
      (def?.outcomeClass && /success|won|qualified/i.test(def.outcomeClass));
    if (isSuccess) bucket.conversions += 1;
    byCampaign.set(cid, bucket);
  }

  const campaigns = await prisma.powerDialerCampaign.findMany({
    where: { workspaceId, id: { in: [...byCampaign.keys()] } },
    select: { id: true, name: true, configJson: true },
  });

  return campaigns.map((c) => {
    const stats = byCampaign.get(c.id) || { conversions: 0, total: 0 };
    const ext = parseExtendedConfig(c.configJson);
    return {
      campaignId: c.id,
      campaignName: c.name,
      leadSource: ext.leadSource || null,
      conversions: stats.conversions,
      dispositioned: stats.total,
      conversionRatePct:
        stats.total > 0 ? Math.round((stats.conversions / stats.total) * 1000) / 10 : 0,
    };
  });
}
