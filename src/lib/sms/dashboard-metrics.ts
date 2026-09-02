import "server-only";

import { getPrisma } from "@/lib/db";
import { mapCampaign } from "@/lib/mappers";
import { campaignConfigIsMassText } from "@/lib/mass-texting/campaign-send";
import { resolveMassTextSendingNumber } from "@/lib/mass-texting/messaging-registration";

export type SmsDashboardActivityPoint = {
  date: string;
  sent: number;
  delivered: number;
  replies: number;
};

export type SmsDashboardMetrics = {
  activeContacts: number;
  contactsAddedThisMonth: number;
  messagesSent30Days: number;
  deliveryRate: number;
  deliveredCount: number;
  replies: number;
  replyRate: number;
  complianceHealthy: boolean;
  a2pStatus: string;
  attention: {
    unreadConversations: number;
    failedMessages30d: number;
    contactsNeedingAttention: number;
  };
  recentReplies: Array<{
    id: string;
    contactName: string;
    preview: string;
    at: string;
    conversationId: string;
  }>;
  recentCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    sent: number;
    deliveryRate: number;
    clicks: number;
    replies: number;
    sentAt: string | null;
  }>;
  upcomingScheduled: Array<{ id: string; name: string; scheduledAt: string }>;
  creditsRemaining: number;
  sendingNumber: string | null;
  messagingActivity: SmsDashboardActivityPoint[];
};

const SENT_STATUSES = ["sent", "delivered", "clicked"];
const DELIVERED_STATUSES = ["delivered", "clicked"];
const FAILURE_STATUSES = ["failed", "undelivered", "expired"];

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

const contactBaseWhere = (workspaceId: string) => ({
  workspaceId,
  NOT: { customFields: { path: ["systemAutomationContact"], equals: true } },
});

export async function loadSmsDashboardActivity(
  workspaceId: string,
  days: number,
): Promise<SmsDashboardActivityPoint[]> {
  const prisma = getPrisma();
  const to = new Date();
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [messages, inboundReplies] = await Promise.all([
    prisma.campaignMessage.findMany({
      where: {
        workspaceId,
        createdAt: { gte: from, lte: to },
        status: { in: [...SENT_STATUSES, ...FAILURE_STATUSES] },
      },
      select: { status: true, createdAt: true },
    }),
    prisma.conversationMessage.findMany({
      where: {
        direction: "inbound",
        createdAt: { gte: from, lte: to },
        conversation: { workspaceId },
      },
      select: { createdAt: true },
    }),
  ]);

  const buckets = new Map<string, SmsDashboardActivityPoint>();

  for (const m of messages) {
    const key = dayKey(m.createdAt);
    const row = buckets.get(key) || { date: key, sent: 0, delivered: 0, replies: 0 };
    const s = m.status.toLowerCase();
    if (SENT_STATUSES.includes(s)) row.sent += 1;
    if (DELIVERED_STATUSES.includes(s)) row.delivered += 1;
    buckets.set(key, row);
  }

  for (const r of inboundReplies) {
    const key = dayKey(r.createdAt);
    const row = buckets.get(key) || { date: key, sent: 0, delivered: 0, replies: 0 };
    row.replies += 1;
    buckets.set(key, row);
  }

  const series: SmsDashboardActivityPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    const key = dayKey(d);
    series.push(buckets.get(key) || { date: key, sent: 0, delivered: 0, replies: 0 });
  }

  return series;
}

export async function loadSmsDashboardMetrics(workspaceId: string): Promise<SmsDashboardMetrics> {
  const prisma = getPrisma();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    activeContacts,
    contactsAddedThisMonth,
    campaigns,
    audits,
    registration,
    sender,
    messagingActivity,
    unreadConversations,
    failedMessages30d,
    contactsNeedingAttention,
    recentInbound,
    messages30d,
    replies30d,
  ] = await Promise.all([
    prisma.contact.count({
      where: { ...contactBaseWhere(workspaceId), status: "SUBSCRIBED" },
    }),
    prisma.contact.count({
      where: {
        ...contactBaseWhere(workspaceId),
        status: "SUBSCRIBED",
        createdAt: { gte: monthStart },
      },
    }),
    prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        status: true,
        sent: true,
        delivered: true,
        replies: true,
        clicks: true,
        scheduledAt: true,
        createdAt: true,
        configJson: true,
      },
    }),
    prisma.campaignLaunchAudit.findMany({
      where: { workspaceId },
      select: { campaignId: true },
    }),
    prisma.messagingRegistration.findUnique({ where: { workspaceId } }),
    resolveMassTextSendingNumber(workspaceId),
    loadSmsDashboardActivity(workspaceId, 30),
    prisma.conversation.count({
      where: { workspaceId, unread: true, status: "OPEN" },
    }),
    prisma.campaignMessage.count({
      where: {
        workspaceId,
        createdAt: { gte: thirtyDaysAgo },
        status: { in: FAILURE_STATUSES },
      },
    }),
    prisma.contact.count({
      where: {
        ...contactBaseWhere(workspaceId),
        status: { in: ["INVALID", "BLOCKED"] },
      },
    }),
    prisma.conversationMessage.findMany({
      where: {
        direction: "inbound",
        conversation: { workspaceId },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        body: true,
        createdAt: true,
        conversationId: true,
        conversation: {
          select: {
            contact: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
      },
    }),
    prisma.campaignMessage.findMany({
      where: {
        workspaceId,
        createdAt: { gte: thirtyDaysAgo },
        status: { in: SENT_STATUSES },
      },
      select: { status: true },
    }),
    prisma.conversationMessage.count({
      where: {
        direction: "inbound",
        createdAt: { gte: thirtyDaysAgo },
        conversation: { workspaceId },
      },
    }),
  ]);

  const launchedIds = new Set(audits.map((a: { campaignId: string }) => a.campaignId));
  const massTextCampaigns = campaigns.filter(
    (c) => launchedIds.has(c.id) || campaignConfigIsMassText(c.configJson),
  );

  let delivered30d = 0;
  for (const m of messages30d) {
    if (DELIVERED_STATUSES.includes(m.status.toLowerCase())) delivered30d += 1;
  }
  const messagesSent30Days = messages30d.length;

  const { getSegmentAvailability } = await import("@/lib/mass-texting/credit-accounting");
  const unifiedCredits = await getSegmentAvailability(workspaceId);

  const upcomingScheduled = massTextCampaigns
    .filter(
      (c) =>
        c.status === "SCHEDULED" &&
        c.scheduledAt &&
        c.scheduledAt >= new Date(),
    )
    .sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime())
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      name: c.name,
      scheduledAt: c.scheduledAt!.toISOString(),
    }));

  const recentSource = massTextCampaigns.slice(0, 8);

  const campaignOk = (registration?.campaignStatus || "").toLowerCase() === "approved";
  const brandOk = (registration?.brandStatus || "").toLowerCase() === "approved";
  const a2pStatus = campaignOk ? "Approved" : brandOk || registration ? "Pending" : "Pending";
  const complianceHealthy = campaignOk && brandOk;

  const recentReplies = recentInbound
    .filter((m) => m.conversation?.contact)
    .map((m) => {
      const c = m.conversation!.contact;
      const name =
        [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.phone || "Contact";
      return {
        id: m.id,
        contactName: name,
        preview: m.body.length > 80 ? `${m.body.slice(0, 80)}…` : m.body,
        at: m.createdAt.toISOString(),
        conversationId: m.conversationId,
      };
    });

  const recentCampaigns = (
    await Promise.all(
      recentSource.map(async (c) => {
        const mapped = mapCampaign(c);
        const [rowSent, rowDelivered, lastSent] = await Promise.all([
          prisma.campaignMessage.count({
            where: { campaignId: c.id, status: { in: SENT_STATUSES } },
          }),
          prisma.campaignMessage.count({
            where: { campaignId: c.id, status: { in: DELIVERED_STATUSES } },
          }),
          prisma.campaignMessage.findFirst({
            where: { campaignId: c.id, sentAt: { not: null } },
            orderBy: { sentAt: "desc" },
            select: { sentAt: true },
          }),
        ]);
        const sent = rowSent > 0 ? rowSent : mapped.sent;
        const delivered = rowSent > 0 ? rowDelivered : mapped.delivered;
        return {
          id: mapped.id,
          name: mapped.name,
          status: mapped.status,
          sent,
          deliveryRate: pct(delivered, sent),
          clicks: mapped.clicks,
          replies: mapped.replies,
          sentAt:
            lastSent?.sentAt?.toISOString() ??
            mapped.scheduledAt ??
            c.createdAt.toISOString(),
        };
      }),
    )
  ).sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime());

  return {
    activeContacts,
    contactsAddedThisMonth,
    messagesSent30Days,
    deliveryRate: pct(delivered30d, messagesSent30Days),
    deliveredCount: delivered30d,
    replies: replies30d,
    replyRate: pct(replies30d, messagesSent30Days),
    complianceHealthy,
    a2pStatus,
    attention: {
      unreadConversations,
      failedMessages30d,
      contactsNeedingAttention,
    },
    recentReplies,
    recentCampaigns,
    upcomingScheduled,
    creditsRemaining: unifiedCredits.available,
    sendingNumber: sender?.phoneE164 ?? registration?.phoneE164 ?? null,
    messagingActivity,
  };
}
