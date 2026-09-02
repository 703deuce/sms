import "server-only";

import { getPrisma } from "@/lib/db";
import { mapCampaign } from "@/lib/mappers";
import { campaignConfigIsMassText } from "@/lib/mass-texting/campaign-send";
import {
  getMessagingProductRegistration,
  resolveMassTextSendingNumber,
} from "@/lib/mass-texting/messaging-registration";
import {
  isApprovedMessagingStatus,
  isHpCertifiedSmsNumber,
  workspaceMessagingStatusLabel,
} from "@/lib/messaging/preferred-sending-number";

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
  draftCampaignCount: number;
  attention: {
    unreadConversations: number;
    failedMessages30d: number;
    invalidContacts: number;
    blockedContacts: number;
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

type MassTextCampaignRow = {
  id: string;
  name: string;
  type: string;
  audience: string;
  status: string;
  sent: number;
  delivered: number;
  replies: number;
  clicks: number;
  optOuts: number;
  body: string;
  createdBy: string | null;
  scheduledAt: Date | null;
  createdAt: Date;
  configJson: unknown;
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function formatA2pStatus(raw: string): string {
  const s = raw.toLowerCase();
  if (s === "approved" || s === "ready" || s === "certified") return "Approved";
  if (s === "not_started") return "Not started";
  if (!s) return "Not started";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const contactBaseWhere = (workspaceId: string) => ({
  workspaceId,
  NOT: { customFields: { path: ["systemAutomationContact"], equals: true } },
});

function filterMassTextCampaignIds(
  campaigns: Array<{ id: string; configJson: unknown }>,
  launchedIds: Set<string>,
): string[] {
  return campaigns
    .filter((c) => launchedIds.has(c.id) || campaignConfigIsMassText(c.configJson))
    .map((c) => c.id);
}

function filterMassTextCampaigns(
  campaigns: MassTextCampaignRow[],
  launchedIds: Set<string>,
): MassTextCampaignRow[] {
  return campaigns.filter(
    (c) => launchedIds.has(c.id) || campaignConfigIsMassText(c.configJson),
  );
}

export async function loadSmsDashboardActivity(
  workspaceId: string,
  days: number,
  massTextCampaignIds: string[] = [],
): Promise<SmsDashboardActivityPoint[]> {
  const prisma = getPrisma();
  const to = new Date();
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [messages, inboundReplies] = await Promise.all([
    massTextCampaignIds.length
      ? prisma.campaignMessage.findMany({
          where: {
            workspaceId,
            campaignId: { in: massTextCampaignIds },
            createdAt: { gte: from, lte: to },
            status: { in: [...SENT_STATUSES, ...FAILURE_STATUSES] },
          },
          select: { status: true, createdAt: true },
        })
      : Promise.resolve([]),
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

export async function loadSmsDashboardActivityForWorkspace(
  workspaceId: string,
  days: number,
): Promise<SmsDashboardActivityPoint[]> {
  const prisma = getPrisma();
  const [campaigns, audits] = await Promise.all([
    prisma.campaign.findMany({
      where: { workspaceId },
      select: { id: true, configJson: true },
    }),
    prisma.campaignLaunchAudit.findMany({
      where: { workspaceId },
      select: { campaignId: true },
    }),
  ]);
  const launchedIds = new Set<string>(audits.map((a: { campaignId: string }) => a.campaignId));
  const massTextIds = filterMassTextCampaignIds(campaigns, launchedIds);
  return loadSmsDashboardActivity(workspaceId, days, massTextIds);
}

async function loadRecentMassTextCampaigns(
  workspaceId: string,
  massTextCampaigns: MassTextCampaignRow[],
  massTextIds: string[],
) {
  const prisma = getPrisma();
  if (!massTextIds.length) return [];

  const recentSends = await prisma.campaignMessage.findMany({
    where: {
      workspaceId,
      campaignId: { in: massTextIds },
      sentAt: { not: null },
    },
    orderBy: { sentAt: "desc" },
    select: { campaignId: true, sentAt: true },
  });

  const seenCampaigns = new Set<string>();
  const orderedIds: string[] = [];
  for (const row of recentSends) {
    if (seenCampaigns.has(row.campaignId)) continue;
    seenCampaigns.add(row.campaignId);
    orderedIds.push(row.campaignId);
    if (orderedIds.length >= 8) break;
  }

  const source =
    orderedIds.length > 0
      ? orderedIds
          .map((id) => massTextCampaigns.find((c) => c.id === id))
          .filter((c): c is MassTextCampaignRow => Boolean(c))
      : massTextCampaigns.slice(0, 8);

  return Promise.all(
    source.map(async (c) => {
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
  ).then((rows) =>
    rows.sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime()),
  );
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
    mtRegistration,
    sender,
    unreadConversations,
    invalidContacts,
    blockedContacts,
    recentInbound,
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
      take: 200,
      select: {
        id: true,
        name: true,
        type: true,
        audience: true,
        body: true,
        status: true,
        sent: true,
        delivered: true,
        replies: true,
        clicks: true,
        optOuts: true,
        createdBy: true,
        scheduledAt: true,
        createdAt: true,
        configJson: true,
      },
    }),
    prisma.campaignLaunchAudit.findMany({
      where: { workspaceId },
      select: { campaignId: true },
    }),
    prisma.messagingRegistration.findUnique({
      where: { workspaceId },
      select: {
        brandStatus: true,
        campaignStatus: true,
        phoneAttached: true,
        phoneE164: true,
      },
    }),
    getMessagingProductRegistration(workspaceId, "MASS_TEXT_MARKETING"),
    resolveMassTextSendingNumber(workspaceId),
    prisma.conversation.count({
      where: { workspaceId, unread: true, status: "OPEN" },
    }),
    prisma.contact.count({
      where: {
        ...contactBaseWhere(workspaceId),
        status: "INVALID",
      },
    }),
    prisma.contact.count({
      where: {
        ...contactBaseWhere(workspaceId),
        status: "BLOCKED",
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
    prisma.conversationMessage.count({
      where: {
        direction: "inbound",
        createdAt: { gte: thirtyDaysAgo },
        conversation: { workspaceId },
      },
    }),
  ]);

  const launchedIds = new Set<string>(audits.map((a: { campaignId: string }) => a.campaignId));
  const massTextCampaigns = filterMassTextCampaigns(campaigns, launchedIds);
  const massTextIds = massTextCampaigns.map((c) => c.id);

  const [messages30d, failedCount30d, messagingActivity, recentCampaigns] = await Promise.all([
    massTextIds.length
      ? prisma.campaignMessage.findMany({
          where: {
            workspaceId,
            campaignId: { in: massTextIds },
            createdAt: { gte: thirtyDaysAgo },
            status: { in: SENT_STATUSES },
          },
          select: { status: true },
        })
      : Promise.resolve([]),
    massTextIds.length
      ? prisma.campaignMessage.count({
          where: {
            workspaceId,
            campaignId: { in: massTextIds },
            createdAt: { gte: thirtyDaysAgo },
            status: { in: FAILURE_STATUSES },
          },
        })
      : Promise.resolve(0),
    loadSmsDashboardActivity(workspaceId, 30, massTextIds),
    loadRecentMassTextCampaigns(workspaceId, massTextCampaigns, massTextIds),
  ]);

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

  const sendingApproved =
    Boolean(sender?.phoneE164) &&
    (isHpCertifiedSmsNumber(sender?.phoneE164) ||
      isApprovedMessagingStatus(mtRegistration?.overallStatus) ||
      isApprovedMessagingStatus(registration?.campaignStatus) ||
      isApprovedMessagingStatus(registration?.brandStatus));
  const workspaceReady = Boolean(
    registration?.phoneAttached &&
      registration.phoneE164 &&
      isApprovedMessagingStatus(registration.campaignStatus) &&
      isApprovedMessagingStatus(registration.brandStatus),
  );
  const a2pStatusRaw = workspaceMessagingStatusLabel({
    productRegistrationStatus: mtRegistration?.overallStatus,
    sendingNumberApproved: sendingApproved,
    workspaceRegistrationReady: workspaceReady,
  });
  const a2pStatus = formatA2pStatus(a2pStatusRaw);
  const complianceHealthy = a2pStatusRaw === "approved" || workspaceReady;

  const recentReplies = recentInbound
    .filter((m: (typeof recentInbound)[number]) => m.conversation?.contact)
    .map((m: (typeof recentInbound)[number]) => {
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

  const draftCampaignCount = massTextCampaigns.filter((c) => c.status === "DRAFT").length;

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
    draftCampaignCount,
    attention: {
      unreadConversations,
      failedMessages30d: failedCount30d,
      invalidContacts,
      blockedContacts,
    },
    recentReplies,
    recentCampaigns,
    upcomingScheduled,
    creditsRemaining: unifiedCredits.available,
    sendingNumber: sender?.phoneE164 ?? registration?.phoneE164 ?? null,
    messagingActivity,
  };
}
