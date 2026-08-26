import "server-only";

import { getPrisma } from "@/lib/db";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { resolveMassTextSendingNumber } from "@/lib/mass-texting/messaging-registration";

export type MassTextOverviewMetrics = {
  messagesSentMonth: number;
  delivered: number;
  deliveryRate: number;
  replies: number;
  replyRate: number;
  optOuts: number;
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

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { creditBalanceCents: true },
  });

  const [campaignAgg, monthMessages, upcoming, recent, sender, registration] = await Promise.all([
    prisma.campaign.aggregate({
      where: { workspaceId },
      _sum: { sent: true, delivered: true, replies: true, optOuts: true },
    }),
    prisma.campaignMessage.count({
      where: {
        workspaceId,
        createdAt: { gte: monthStart },
        status: { in: ["sent", "delivered", "clicked"] },
      },
    }),
    prisma.campaign.findMany({
      where: { workspaceId, status: "SCHEDULED", scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      select: { id: true, name: true, scheduledAt: true },
    }),
    prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        status: true,
        sent: true,
        delivered: true,
        replies: true,
        scheduledAt: true,
      },
    }),
    resolveMassTextSendingNumber(workspaceId),
    getRegistrationByWorkspace(workspaceId),
  ]);

  const sent = campaignAgg._sum.sent ?? 0;
  const delivered = campaignAgg._sum.delivered ?? 0;
  const replies = campaignAgg._sum.replies ?? 0;
  const optOuts = campaignAgg._sum.optOuts ?? 0;

  return {
    messagesSentMonth: monthMessages,
    delivered,
    deliveryRate: sent > 0 ? Math.round((delivered / sent) * 1000) / 10 : 0,
    replies,
    replyRate: sent > 0 ? Math.round((replies / sent) * 1000) / 10 : 0,
    optOuts,
    creditsRemainingCents: workspace?.creditBalanceCents ?? 0,
    sendingNumber: sender?.phoneE164 ?? null,
    a2pStatus: registration?.overallStatus ?? "not_started",
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
