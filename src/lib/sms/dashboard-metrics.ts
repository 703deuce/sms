import "server-only";

import { getPrisma } from "@/lib/db";
import { mapCampaign } from "@/lib/mappers";

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

  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
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
    registration,
    messagingActivity,
    unreadConversations,
    failedMessages30d,
    contactsNeedingAttention,
    recentInbound,
    messages30d,
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
      take: 5,
    }),
    prisma.messagingRegistration.findUnique({ where: { workspaceId } }),
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
  ]);

  let delivered30d = 0;
  for (const m of messages30d) {
    if (DELIVERED_STATUSES.includes(m.status.toLowerCase())) delivered30d += 1;
  }
  const messagesSent30Days = messages30d.length;
  const replies = campaigns.reduce((sum, c) => sum + (c.replies || 0), 0);
  const totalSent = campaigns.reduce((sum, c) => sum + (c.sent || 0), 0);

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

  const recentCampaigns = campaigns.map((c) => {
    const mapped = mapCampaign(c);
    return {
      id: mapped.id,
      name: mapped.name,
      status: mapped.status,
      sent: mapped.sent,
      deliveryRate: pct(mapped.delivered, mapped.sent),
      clicks: mapped.clicks,
      replies: mapped.replies,
      sentAt: mapped.scheduledAt || c.createdAt.toISOString(),
    };
  });

  return {
    activeContacts,
    contactsAddedThisMonth,
    messagesSent30Days,
    deliveryRate: pct(delivered30d, messagesSent30Days),
    deliveredCount: delivered30d,
    replies,
    replyRate: pct(replies, totalSent),
    complianceHealthy,
    a2pStatus,
    attention: {
      unreadConversations,
      failedMessages30d,
      contactsNeedingAttention,
    },
    recentReplies,
    recentCampaigns,
    messagingActivity,
  };
}
