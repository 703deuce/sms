import "server-only";

import { getPrisma } from "@/lib/db";
import { countVisibleListMembersBulk } from "@/lib/contacts/workspace-membership";

export type SmsAnalyticsRange = {
  from: Date;
  to: Date;
  compareFrom?: Date;
  compareTo?: Date;
};

export type SmsAnalyticsKpis = {
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
  optOuts: number;
};

export type SmsAnalyticsTimePoint = {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
  replies: number;
  uniqueClicks: number;
  optOuts: number;
};

export type SmsCampaignPerformanceRow = {
  id: string;
  name: string;
  sentAt: string | null;
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

export type SmsFailureReasonRow = {
  category: string;
  label: string;
  count: number;
};

export type SmsAudienceGrowthPoint = {
  date: string;
  optIns: number;
  unsubscribes: number;
};

export type SmsSubscriberSourceRow = {
  source: string;
  count: number;
  share: number;
};

export type SmsTopListRow = {
  id: string;
  name: string;
  contacts: number;
};

export type SmsAudienceAnalytics = {
  activeContacts: number;
  newOptIns: number;
  unsubscribes: number;
  netGrowth: number;
  growthSeries: SmsAudienceGrowthPoint[];
  sources: SmsSubscriberSourceRow[];
  topLists: SmsTopListRow[];
};

export type SmsAnalyticsPayload = {
  range: { from: string; to: string };
  kpis: SmsAnalyticsKpis;
  compareKpis?: SmsAnalyticsKpis | null;
  timeSeries: SmsAnalyticsTimePoint[];
  failureReasons: SmsFailureReasonRow[];
  campaigns: SmsCampaignPerformanceRow[];
  audience: SmsAudienceAnalytics;
};

const FAILURE_STATUSES = new Set(["failed", "undelivered", "expired", "error"]);
const PENDING_STATUSES = new Set(["queued", "sending", "pending", "accepted", "sent"]);
const DELIVERED_STATUSES = new Set(["delivered", "clicked", "read"]);
const SENT_STATUSES = new Set(["sent", "delivered", "clicked", "read"]);

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function categorizeFailure(error: string | null | undefined): string {
  const e = (error || "").toLowerCase();
  if (!e) return "Unknown";
  if (e.includes("invalid") || e.includes("not a valid") || e.includes("not valid")) return "Invalid number";
  if (e.includes("landline") || e.includes("fixed line")) return "Landline";
  if (e.includes("opt") || e.includes("unsub") || e.includes("stop")) return "Opted out";
  if (e.includes("carrier") || e.includes("reject") || e.includes("blocked")) return "Carrier rejected";
  if (e.includes("unreachable") || e.includes("unavailable") || e.includes("timeout")) return "Unreachable";
  if (e.includes("provider") || e.includes("telnyx") || e.includes("twilio")) return "Provider error";
  return "Other";
}

function categorizeConsentSource(source: string | null): string {
  const s = (source || "").toLowerCase();
  if (s.startsWith("form:") || s.includes("form")) return "Form";
  if (s.startsWith("keyword:") || s.includes("keyword")) return "Keyword";
  if (s.includes("qr")) return "QR";
  if (s === "import" || s.includes("import")) return "Import";
  if (s === "manual" || s.includes("manual")) return "Manual";
  if (s.includes("api") || s.includes("webhook") || s.includes("integration")) return "API";
  return "Other";
}

const contactBaseWhere = (workspaceId: string) => ({
  workspaceId,
  NOT: { customFields: { path: ["systemAutomationContact"], equals: true } },
});

export function parseSmsAnalyticsRange(params: URLSearchParams): SmsAnalyticsRange {
  const rawDays = Number(params.get("days") || "30");
  const days = [7, 30, 90].includes(rawDays) ? rawDays : 30;
  const to = new Date();
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const range: SmsAnalyticsRange = { from, to };

  if (params.get("compare") === "1") {
    const span = to.getTime() - from.getTime();
    range.compareTo = new Date(from.getTime() - 1);
    range.compareFrom = new Date(from.getTime() - span);
  }

  return range;
}

function buildKpis(input: {
  messages: Array<{ status: string }>;
  campaignAgg: { sent: number; delivered: number; failed: number; replies: number; clicks: number; optOuts: number };
  uniqueClicks: number;
}): SmsAnalyticsKpis {
  let delivered = 0;
  let failed = 0;
  let pending = 0;

  for (const m of input.messages) {
    const s = m.status.toLowerCase();
    if (DELIVERED_STATUSES.has(s)) delivered += 1;
    else if (FAILURE_STATUSES.has(s)) failed += 1;
    else if (PENDING_STATUSES.has(s)) pending += 1;
  }

  const sent = input.messages.length || input.campaignAgg.sent;
  const deliveredCount = delivered || input.campaignAgg.delivered;
  const replies = input.campaignAgg.replies;
  const optOuts = input.campaignAgg.optOuts;

  return {
    messagesSent: sent,
    delivered: deliveredCount,
    failed: failed || input.campaignAgg.failed,
    pending,
    deliveryRate: pct(deliveredCount, sent),
    replyRate: pct(replies, sent),
    clickRate: pct(input.uniqueClicks, sent),
    optOutRate: pct(optOuts, sent),
    replies,
    uniqueClicks: input.uniqueClicks,
    optOuts,
  };
}

async function loadAudienceAnalytics(
  workspaceId: string,
  range: SmsAnalyticsRange,
): Promise<SmsAudienceAnalytics> {
  const prisma = getPrisma();

  const [activeContacts, contacts, lists] = await Promise.all([
    prisma.contact.count({ where: { ...contactBaseWhere(workspaceId), status: "SUBSCRIBED" } }),
    prisma.contact.findMany({
      where: contactBaseWhere(workspaceId),
      select: { status: true, createdAt: true, consentDate: true, consentSource: true },
    }),
    prisma.contactList.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
      take: 20,
    }),
  ]);

  let newOptIns = 0;
  let unsubscribes = 0;
  const growthBuckets = new Map<string, SmsAudienceGrowthPoint>();
  const sourceBuckets = new Map<string, number>();

  for (const c of contacts) {
    const at = c.consentDate || c.createdAt;
    if (at < range.from || at > range.to) continue;

    const key = dayKey(at);
    const row = growthBuckets.get(key) || { date: key, optIns: 0, unsubscribes: 0 };

    if (c.status === "SUBSCRIBED") {
      newOptIns += 1;
      row.optIns += 1;
      const src = categorizeConsentSource(c.consentSource);
      sourceBuckets.set(src, (sourceBuckets.get(src) || 0) + 1);
    } else if (c.status === "UNSUBSCRIBED") {
      unsubscribes += 1;
      row.unsubscribes += 1;
    }
    growthBuckets.set(key, row);
  }

  const sourceTotal = [...sourceBuckets.values()].reduce((s, n) => s + n, 0);
  const listCounts = await countVisibleListMembersBulk(
    workspaceId,
    lists.map((l) => l.id),
  );

  return {
    activeContacts,
    newOptIns,
    unsubscribes,
    netGrowth: newOptIns - unsubscribes,
    growthSeries: [...growthBuckets.values()].sort((a, b) => a.date.localeCompare(b.date)),
    sources: [...sourceBuckets.entries()]
      .map(([source, count]) => ({
        source,
        count,
        share: sourceTotal > 0 ? pct(count, sourceTotal) : 0,
      }))
      .sort((a, b) => b.count - a.count),
    topLists: [...lists]
      .map((l) => ({
        id: l.id,
        name: l.name,
        contacts: listCounts.get(l.id) || 0,
      }))
      .sort((a, b) => b.contacts - a.contacts)
      .slice(0, 5),
  };
}

async function loadPeriodData(workspaceId: string, range: SmsAnalyticsRange) {
  const prisma = getPrisma();

  const messages = await prisma.campaignMessage.findMany({
    where: {
      workspaceId,
      createdAt: { gte: range.from, lte: range.to },
    },
    select: { status: true, createdAt: true, error: true, campaignId: true },
  });

  const campaignIdsFromMessages = [
    ...new Set(messages.map((m) => m.campaignId).filter(Boolean)),
  ] as string[];

  const campaignWhere = campaignIdsFromMessages.length
    ? {
        workspaceId,
        OR: [
          { id: { in: campaignIdsFromMessages } },
          { createdAt: { gte: range.from, lte: range.to } },
        ],
      }
    : {
        workspaceId,
        createdAt: { gte: range.from, lte: range.to },
      };

  const [campaigns, clicks, compareCampaigns, compareMessages] = await Promise.all([
    prisma.campaign.findMany({
      where: campaignWhere,
      select: {
        id: true,
        name: true,
        sent: true,
        delivered: true,
        replies: true,
        clicks: true,
        optOuts: true,
        createdAt: true,
        scheduledAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.linkClickEvent.findMany({
      where: {
        workspaceId,
        createdAt: { gte: range.from, lte: range.to },
      },
      select: {
        trackingToken: true,
        contactId: true,
        createdAt: true,
      },
    }),
    range.compareFrom && range.compareTo
      ? prisma.campaign.findMany({
          where: {
            workspaceId,
            createdAt: { gte: range.compareFrom, lte: range.compareTo },
          },
          select: { sent: true, delivered: true, replies: true, clicks: true, optOuts: true },
        })
      : Promise.resolve([]),
    range.compareFrom && range.compareTo
      ? prisma.campaignMessage.findMany({
          where: {
            workspaceId,
            createdAt: { gte: range.compareFrom, lte: range.compareTo },
          },
          select: { status: true },
        })
      : Promise.resolve([]),
  ]);

  const failedMessages = await prisma.campaignMessage.findMany({
    where: {
      workspaceId,
      createdAt: { gte: range.from, lte: range.to },
      status: { in: [...FAILURE_STATUSES] },
    },
    select: { error: true },
  });

  return { messages, campaigns, clicks, compareCampaigns, compareMessages, failedMessages };
}

export async function loadSmsAnalytics(
  workspaceId: string,
  range: SmsAnalyticsRange,
): Promise<SmsAnalyticsPayload> {
  const { messages, campaigns, clicks, compareCampaigns, compareMessages, failedMessages } =
    await loadPeriodData(workspaceId, range);

  const campaignAgg = campaigns.reduce(
    (acc, c) => ({
      sent: acc.sent + (c.sent || 0),
      delivered: acc.delivered + (c.delivered || 0),
      failed: acc.failed,
      replies: acc.replies + (c.replies || 0),
      clicks: acc.clicks + (c.clicks || 0),
      optOuts: acc.optOuts + (c.optOuts || 0),
    }),
    { sent: 0, delivered: 0, failed: 0, replies: 0, clicks: 0, optOuts: 0 },
  );

  const uniqueClickIds = new Set(
    clicks.map((c) => c.contactId || c.trackingToken).filter(Boolean),
  );

  const kpis = buildKpis({
    messages,
    campaignAgg,
    uniqueClicks: uniqueClickIds.size,
  });

  const compareAgg =
    compareCampaigns.length > 0
      ? compareCampaigns.reduce(
          (acc, c) => ({
            sent: acc.sent + (c.sent || 0),
            delivered: acc.delivered + (c.delivered || 0),
            failed: 0,
            replies: acc.replies + (c.replies || 0),
            clicks: acc.clicks + (c.clicks || 0),
            optOuts: acc.optOuts + (c.optOuts || 0),
          }),
          { sent: 0, delivered: 0, failed: 0, replies: 0, clicks: 0, optOuts: 0 },
        )
      : null;

  const compareKpis =
    range.compareFrom && range.compareTo
      ? buildKpis({
          messages: compareMessages,
          campaignAgg: compareAgg || {
            sent: 0,
            delivered: 0,
            failed: 0,
            replies: 0,
            clicks: 0,
            optOuts: 0,
          },
          uniqueClicks: 0,
        })
      : null;

  const buckets = new Map<string, SmsAnalyticsTimePoint>();
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
    if (SENT_STATUSES.has(s)) row.sent += 1;
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
  for (const m of failedMessages) {
    const cat = categorizeFailure(m.error);
    failureCounts.set(cat, (failureCounts.get(cat) || 0) + 1);
  }

  const failureReasons: SmsFailureReasonRow[] = [...failureCounts.entries()]
    .map(([category, count]) => ({ category, label: category, count }))
    .sort((a, b) => b.count - a.count);

  const campaignRows: SmsCampaignPerformanceRow[] = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    sentAt: (c.scheduledAt || c.createdAt)?.toISOString() ?? null,
    sent: c.sent,
    delivered: c.delivered,
    failed: Math.max(0, c.sent - c.delivered),
    deliveryRate: pct(c.delivered, c.sent),
    replies: c.replies,
    replyRate: pct(c.replies, c.sent),
    clicks: c.clicks,
    clickRate: pct(c.clicks, c.sent),
    optOuts: c.optOuts,
    optOutRate: pct(c.optOuts, c.sent),
  }));

  const audience = await loadAudienceAnalytics(workspaceId, range);

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    kpis,
    compareKpis,
    timeSeries: [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date)),
    failureReasons,
    campaigns: campaignRows,
    audience,
  };
}
