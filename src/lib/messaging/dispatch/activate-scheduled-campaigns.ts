import "server-only";

import { getPrisma } from "@/lib/db";

/** Activate scheduled campaigns whose scheduledAt has passed. */
export async function activateDueScheduledCampaigns(workspaceId?: string): Promise<number> {
  const prisma = getPrisma();
  const now = new Date();
  const workspaceFilter = workspaceId ? { workspaceId } : {};

  const dueScheduled = await prisma.campaign.findMany({
    where: {
      ...workspaceFilter,
      status: "SCHEDULED",
      scheduledAt: { lte: now },
    },
    take: 80,
    select: { id: true, workspaceId: true, configJson: true, scheduledAt: true },
  });

  const { campaignConfigIsMassText } = await import("@/lib/mass-texting/campaign-send");
  const { readBroadcastConfig } = await import("@/lib/mass-texting/broadcast/service");
  const { getActiveCampaignReservation, getSegmentAvailability } = await import(
    "@/lib/mass-texting/credit-accounting"
  );

  let activated = 0;
  for (const campaign of dueScheduled) {
    if (campaignConfigIsMassText(campaign.configJson)) {
      const broadcastConfig = readBroadcastConfig(campaign.configJson);
      if (broadcastConfig?.scheduleMode === "recurring") continue;

      const audit = await prisma.campaignLaunchAudit.findFirst({
        where: { workspaceId: campaign.workspaceId, campaignId: campaign.id },
        select: { id: true },
      });
      if (!audit) continue;

      const reservation = await getActiveCampaignReservation(campaign.id);
      const availability = await getSegmentAvailability(campaign.workspaceId);
      if (!reservation && !availability.canSend) {
        await prisma.campaign.updateMany({
          where: { id: campaign.id, status: "SCHEDULED" },
          data: { status: "FAILED" },
        });
        continue;
      }
    }

    const updated = await prisma.campaign.updateMany({
      where: { id: campaign.id, status: "SCHEDULED" },
      data: { status: "SENDING" },
    });
    if (updated.count === 1) {
      activated += 1;
      console.log(
        JSON.stringify({
          event: "campaign_dispatch_started",
          campaignId: campaign.id,
          workspaceId: campaign.workspaceId,
          scheduledAt: campaign.scheduledAt?.toISOString(),
          activatedAt: now.toISOString(),
        }),
      );
    }
  }
  return activated;
}
