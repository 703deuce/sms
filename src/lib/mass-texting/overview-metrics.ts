import "server-only";

import { getPrisma } from "@/lib/db";
import { getMassTextingBillingSummary } from "@/lib/mass-texting/billing-account";
import { campaignConfigIsMassText } from "@/lib/mass-texting/campaign-send";
import { getMessagingProductRegistration, resolveMassTextSendingNumber } from "@/lib/mass-texting/messaging-registration";

export type MassTextOverviewMetrics = {
  messagesSentMonth: number;
  delivered: number;
  deliveryRate: number;
  replies: number;
  replyRate: number;
  optOuts: number;
  creditsRemaining: number;
  /** @deprecated use creditsRemaining — kept so older UI copies still compile. */
  creditsRemainingCents: number;
  sendingNumber: string | null;
  a2pStatus: string;
  upcomingScheduled: Array<{ id: string; name: string; scheduledAt: string }>;
  recentCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    sent: number;
    delivered: number;
    replies: number;
    scheduledAt: string | null;
  }>;
};

export async function loadMassTextOverviewMetrics(
  workspaceId: string,
): Promise<MassTextOverviewMetrics> {
  const prisma = getPrisma();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [allCampaigns, audits, sender, mtRegistration, billing] = await Promise.all([
    prisma.campaign.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        status: true,
        sent: true,
        delivered: true,
        replies: true,
        optOuts: true,
        scheduledAt: true,
        createdAt: true,
        configJson: true,
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
    prisma.campaignLaunchAudit.findMany({
      where: { workspaceId },
      select: { campaignId: true },
    }),
    resolveMassTextSendingNumber(workspaceId),
    getMessagingProductRegistration(workspaceId, "MASS_TEXT_MARKETING"),
    getMassTextingBillingSummary(workspaceId),
  ]);

  const launchedIds = new Set(audits.map((a: { campaignId: string }) => a.campaignId));
  const massTextCampaigns = allCampaigns.filter(
    (c: { id: string; configJson: unknown }) =>
      launchedIds.has(c.id) || campaignConfigIsMassText(c.configJson),
  );
  const massTextIds = massTextCampaigns.map((c: { id: string }) => c.id);

  const monthMessages = massTextIds.length
    ? await prisma.campaignMessage.count({
        where: {
          workspaceId,
          campaignId: { in: massTextIds },
          createdAt: { gte: monthStart },
          status: { in: ["sent", "delivered", "clicked"] },
        },
      })
    : 0;

  const sent = massTextCampaigns.reduce((sum: number, c: { sent: number }) => sum + (c.sent || 0), 0);
  const delivered = massTextCampaigns.reduce(
    (sum: number, c: { delivered: number }) => sum + (c.delivered || 0),
    0,
  );
  const replies = massTextCampaigns.reduce(
    (sum: number, c: { replies: number }) => sum + (c.replies || 0),
    0,
  );
  const optOuts = massTextCampaigns.reduce(
    (sum: number, c: { optOuts: number }) => sum + (c.optOuts || 0),
    0,
  );
  const upcoming = massTextCampaigns
    .filter(
      (c: { status: string; scheduledAt: Date | null }) =>
        c.status === "SCHEDULED" && c.scheduledAt && c.scheduledAt >= new Date(),
    )
    .slice(0, 5);
  const recent = massTextCampaigns.slice(0, 5);
  const creditsRemaining =
    billing.lifecycleState === "TRIAL_ACTIVE"
      ? billing.trialSegmentsRemaining
      : billing.monthlySegmentsRemaining + billing.paygCreditsSegments;

  return {
    messagesSentMonth: monthMessages,
    delivered,
    deliveryRate: sent > 0 ? Math.round((delivered / sent) * 1000) / 10 : 0,
    replies,
    replyRate: sent > 0 ? Math.round((replies / sent) * 1000) / 10 : 0,
    optOuts,
    creditsRemaining,
    creditsRemainingCents: creditsRemaining,
    sendingNumber: sender?.phoneE164 ?? null,
    a2pStatus: mtRegistration?.overallStatus ?? "not_started",
    upcomingScheduled: upcoming.map((c: (typeof upcoming)[number]) => ({
      id: c.id,
      name: c.name,
      scheduledAt: c.scheduledAt?.toISOString() ?? "",
    })),
    recentCampaigns: recent.map((c: (typeof recent)[number]) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      sent: c.sent,
      delivered: c.delivered,
      replies: c.replies,
      scheduledAt: c.scheduledAt?.toISOString() ?? null,
    })),
  };
}
