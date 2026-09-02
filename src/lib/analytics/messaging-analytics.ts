import "server-only";

import { getPrisma } from "@/lib/db";
import { failureCategoryLabel, type FailureCategory } from "@/lib/messaging/delivery-errors";

type CampaignAggRow = {
  sent: number;
  delivered: number;
  failed: number;
  replies: number;
  clicks: number;
  optOuts: number;
};

type CampaignRow = CampaignAggRow & { id: string; name: string; createdAt: Date };

export type MessagingAnalyticsRange = {
  from: Date;
  to: Date;
  compareFrom?: Date;
  compareTo?: Date;
};

export type MessagingAnalyticsKpis = {
  messagesSent: number;
  delivered: number;
  failed: number;
  pending: number;
  deliveryRate: number;
  replyRate: number;
  clickRate: number;
  optOutRate: number;
  replies: number;
  uniqueClicks: number;
  totalClicks: number;
  optOuts: number;
};

export type MessagingTimeSeriesPoint = {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
  replies: number;
  uniqueClicks: number;
  optOuts: number;
};

export type CampaignPerformanceRow = {
  id: string;
  name: string;
  sent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
  replies: number;
  replyRate: number;
  clicks: number;
  clickRate: number;
  optOuts: number;
  optOutRate: number;
};

export type FailureReasonRow = {
  category: FailureCategory | "unknown";
  label: string;
  count: number;
};

export type TopLinkRow = {
  destinationUrl: string;
  campaignId: string | null;
  campaignName: string | null;
  uniqueClicks: number;
  totalClicks: number;
  ctr: number;
};

export type MessagingAnalyticsPayload = {
  range: { from: string; to: string };
  kpis: MessagingAnalyticsKpis;
  compareKpis?: MessagingAnalyticsKpis | null;
  timeSeries: MessagingTimeSeriesPoint[];
  failureReasons: FailureReasonRow[];
  campaigns: CampaignPerformanceRow[];
  topLinks: TopLinkRow[];
  replyPerformance: {
    replies: number;
    uniqueRepliers: number;
    conversationsStarted: number;
  };
  optOutHealth: {
    optOutRate: number;
    optOuts: number;
    highestCampaign: { id: string; name: string; rate: number } | null;
  };
};

const FAILURE_STATUSES = new Set(["failed", "undelivered", "expired"]);
const PENDING_STATUSES = new Set(["queued", "sending", "pending", "accepted", "sent"]);
const DELIVERED_STATUSES = new Set(["delivered", "clicked", "read"]);

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildKpis(input: {
  messages: Array<{ status: string }>;
  campaignAgg: { sent: number; delivered: number; failed: number; replies: number; clicks: number; optOuts: number };
  uniqueClicks: number;
  totalClicks: number;
}): MessagingAnalyticsKpis {
  let delivered = 0;
  let failed = 0;
  let pending = 0;
  for (const m of input.messages) {
    const s = m.status.toLowerCase();
    if (DELIVERED_STATUSES.has(s)) delivered += 1;
    else if (FAILURE_STATUSES.has(s)) failed += 1;
    else if (PENDING_STATUSES.has(s)) pending += 1;
  }

  const sent = input.campaignAgg.sent || input.messages.length;
  const aggDelivered = input.campaignAgg.delivered || delivered;
  const aggFailed = input.campaignAgg.failed || failed;

  return {
    messagesSent: sent,
    delivered: aggDelivered,
    failed: aggFailed,
    pending: Math.max(0, sent - aggDelivered - aggFailed),
    deliveryRate: pct(aggDelivered, sent),
    replyRate: pct(input.campaignAgg.replies, sent),
    clickRate: pct(input.campaignAgg.clicks, sent),
    optOutRate: pct(input.campaignAgg.optOuts, sent),
    replies: input.campaignAgg.replies,
    uniqueClicks: input.uniqueClicks,
    totalClicks: input.totalClicks,
    optOuts: input.campaignAgg.optOuts,
  };
}

export function parseAnalyticsRange(searchParams: URLSearchParams): MessagingAnalyticsRange {
  const days = Number(searchParams.get("days") || "30");
  const to = searchParams.get("to")
    ? new Date(searchParams.get("to")!)
    : new Date();
  const from = searchParams.get("from")
    ? new Date(searchParams.get("from")!)
    : new Date(to.getTime() - days * 86400000);

  const compare = searchParams.get("compare") === "1";
  if (!compare) return { from, to };

  const span = to.getTime() - from.getTime();
  const compareTo = new Date(from.getTime() - 1);
  const compareFrom = new Date(compareTo.getTime() - span);
  return { from, to, compareFrom, compareTo };
}

export async function loadMessagingAnalytics(
  workspaceId: string,
  range: MessagingAnalyticsRange,
): Promise<MessagingAnalyticsPayload> {
  const prisma = getPrisma();

  const [campaigns, messages, clicks, compareCampaigns] = await Promise.all([
    prisma.campaign.findMany({
      where: {
        workspaceId,
        createdAt: { gte: range.from, lte: range.to },
        status: { in: ["SENDING", "COMPLETED", "FAILED", "Sending", "Completed", "Failed"] },
      },
      select: {
        id: true,
        name: true,
        sent: true,
        delivered: true,
        failed: true,
        replies: true,
        clicks: true,
        optOuts: true,
        createdAt: true,
      },
      orderBy: { sent: "desc" },
      take: 100,
    }),
    prisma.campaignMessage.findMany({
      where: {
        workspaceId,
        createdAt: { gte: range.from, lte: range.to },
      },
      select: { status: true, createdAt: true, failureCategory: true },
      take: 50000,
    }),
    prisma.linkClickEvent.findMany({
      where: {
        workspaceId,
        createdAt: { gte: range.from, lte: range.to },
      },
      select: {
        id: true,
        trackingToken: true,
        contactId: true,
        campaignId: true,
        destinationUrl: true,
        createdAt: true,
      },
    }),
    range.compareFrom && range.compareTo
      ? prisma.campaign.findMany({
          where: {
            workspaceId,
            createdAt: { gte: range.compareFrom, lte: range.compareTo },
          },
          select: { sent: true, delivered: true, failed: true, replies: true, clicks: true, optOuts: true },
        })
      : Promise.resolve([]),
  ]);

  const campaignAgg = campaigns.reduce(
    (acc: CampaignAggRow, c: CampaignRow) => ({
      sent: acc.sent + (c.sent || 0),
      delivered: acc.delivered + (c.delivered || 0),
      failed: acc.failed + (c.failed || 0),
      replies: acc.replies + (c.replies || 0),
      clicks: acc.clicks + (c.clicks || 0),
      optOuts: acc.optOuts + (c.optOuts || 0),
    }),
    { sent: 0, delivered: 0, failed: 0, replies: 0, clicks: 0, optOuts: 0 },
  );

  const uniqueClickContacts = new Set(
    clicks.map((c: (typeof clicks)[number]) => c.contactId || c.trackingToken).filter(Boolean),
  );

  const kpis = buildKpis({
    messages,
    campaignAgg,
    uniqueClicks: uniqueClickContacts.size,
    totalClicks: clicks.length,
  });

  const compareAgg =
    compareCampaigns.length > 0
      ? compareCampaigns.reduce(
          (acc: CampaignAggRow, c: CampaignAggRow) => ({
            sent: acc.sent + (c.sent || 0),
            delivered: acc.delivered + (c.delivered || 0),
            failed: acc.failed + (c.failed || 0),
            replies: acc.replies + (c.replies || 0),
            clicks: acc.clicks + (c.clicks || 0),
            optOuts: acc.optOuts + (c.optOuts || 0),
          }),
          { sent: 0, delivered: 0, failed: 0, replies: 0, clicks: 0, optOuts: 0 },
        )
      : null;

  const compareKpis = compareAgg
    ? buildKpis({
        messages: [],
        campaignAgg: compareAgg,
        uniqueClicks: 0,
        totalClicks: 0,
      })
    : null;

  const buckets = new Map<string, MessagingTimeSeriesPoint>();
  for (const m of messages) {
    const key = dayKey(m.createdAt);
    const row = buckets.get(key) || {
      date: key,
      sent: 0,
      delivered: 0,
      failed: 0,
      replies: 0,
      uniqueClicks: 0,
      optOuts: 0,
    };
    const s = m.status.toLowerCase();
    row.sent += 1;
    if (DELIVERED_STATUSES.has(s)) row.delivered += 1;
    else if (FAILURE_STATUSES.has(s)) row.failed += 1;
    buckets.set(key, row);
  }

  for (const click of clicks) {
    const key = dayKey(click.createdAt);
    const row = buckets.get(key) || {
      date: key,
      sent: 0,
      delivered: 0,
      failed: 0,
      replies: 0,
      uniqueClicks: 0,
      optOuts: 0,
    };
    row.uniqueClicks += 1;
    buckets.set(key, row);
  }

  const failureCounts = new Map<string, number>();
  for (const m of messages) {
    if (!FAILURE_STATUSES.has(m.status.toLowerCase())) continue;
    const cat = (m.failureCategory as FailureCategory | null) || "unknown";
    failureCounts.set(cat, (failureCounts.get(cat) || 0) + 1);
  }

  const failureReasons: FailureReasonRow[] = [...failureCounts.entries()]
    .map(([category, count]) => ({
      category: category as FailureCategory | "unknown",
      label: failureCategoryLabel(category as FailureCategory),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const campaignRows: CampaignPerformanceRow[] = campaigns.map((c: CampaignRow) => ({
    id: c.id,
    name: c.name,
    sent: c.sent,
    delivered: c.delivered,
    failed: c.failed,
    deliveryRate: pct(c.delivered, c.sent),
    replies: c.replies,
    replyRate: pct(c.replies, c.sent),
    clicks: c.clicks,
    clickRate: pct(c.clicks, c.sent),
    optOuts: c.optOuts,
    optOutRate: pct(c.optOuts, c.sent),
  }));

  const linkGroups = new Map<string, { destinationUrl: string; campaignId: string | null; tokens: Set<string>; total: number }>();
  for (const click of clicks) {
    const dest = click.destinationUrl || "Unknown link";
    const key = `${dest}::${click.campaignId || ""}`;
    const row = linkGroups.get(key) || {
      destinationUrl: dest,
      campaignId: click.campaignId,
      tokens: new Set<string>(),
      total: 0,
    };
    row.total += 1;
    if (click.contactId) row.tokens.add(click.contactId);
    else row.tokens.add(click.trackingToken);
    linkGroups.set(key, row);
  }

  const campaignNameById = new Map(campaigns.map((c: CampaignRow) => [c.id, c.name]));
  const topLinks: TopLinkRow[] = [...linkGroups.values()]
    .map((g) => ({
      destinationUrl: g.destinationUrl,
      campaignId: g.campaignId,
      campaignName: g.campaignId ? (campaignNameById.get(g.campaignId) as string | undefined) ?? null : null,
      uniqueClicks: g.tokens.size,
      totalClicks: g.total,
      ctr: pct(g.tokens.size, campaignAgg.sent),
    }))
    .sort((a, b) => b.uniqueClicks - a.uniqueClicks)
    .slice(0, 10);

  const uniqueRepliers = await prisma.conversationMessage
    .findMany({
      where: {
        direction: "inbound",
        createdAt: { gte: range.from, lte: range.to },
        conversation: { workspaceId },
      },
      select: { conversationId: true },
      distinct: ["conversationId"],
    })
    .then((rows: Array<{ conversationId: string }>) => rows.length)
    .catch(() => 0);

  const conversationsStarted = await prisma.conversation
    .count({
      where: {
        workspaceId,
        createdAt: { gte: range.from, lte: range.to },
      },
    })
    .catch(() => 0);

  let highestCampaign: { id: string; name: string; rate: number } | null = null;
  for (const c of campaignRows) {
    if (!highestCampaign || c.optOutRate > highestCampaign.rate) {
      highestCampaign = { id: c.id, name: c.name, rate: c.optOutRate };
    }
  }

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    kpis,
    compareKpis,
    timeSeries: [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date)),
    failureReasons,
    campaigns: campaignRows,
    topLinks,
    replyPerformance: {
      replies: kpis.replies,
      uniqueRepliers,
      conversationsStarted,
    },
    optOutHealth: {
      optOutRate: kpis.optOutRate,
      optOuts: kpis.optOuts,
      highestCampaign: highestCampaign && highestCampaign.rate > 0 ? highestCampaign : null,
    },
  };
}

export async function loadCampaignLiveStats(workspaceId: string, campaignId: string) {
  const prisma = getPrisma();
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId },
    select: {
      id: true,
      name: true,
      status: true,
      sent: true,
      delivered: true,
      failed: true,
      replies: true,
      clicks: true,
      optOuts: true,
    },
  });
  if (!campaign) return null;

  const statusCounts = await prisma.campaignMessage.groupBy({
    by: ["status"],
    where: { workspaceId, campaignId },
    _count: { _all: true },
  });

  const breakdown: Record<string, number> = {};
  for (const row of statusCounts) {
    breakdown[row.status] = row._count._all;
  }

  const pending = (breakdown.queued || 0) + (breakdown.sending || 0);

  return {
    ...campaign,
    pending,
    deliveryRate: pct(campaign.delivered, campaign.sent),
    statusBreakdown: breakdown,
    updatedAt: new Date().toISOString(),
  };
}
