import { getPrisma } from "@/lib/db";

export type MctbAnalyticsRange = "7d" | "30d" | "90d";

export type MctbAnalyticsTrendPoint = { date: string; count: number };

function rangeStart(range: MctbAnalyticsRange): Date {
  const d = new Date();
  if (range === "7d") d.setDate(d.getDate() - 7);
  else if (range === "30d") d.setDate(d.getDate() - 30);
  else d.setDate(d.getDate() - 90);
  d.setHours(0, 0, 0, 0);
  return d;
}

function rangeDays(range: MctbAnalyticsRange): number {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  return 90;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildDailyBuckets(since: Date, days: number): string[] {
  const keys: string[] = [];
  const cursor = new Date(since);
  for (let i = 0; i < days; i++) {
    keys.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function seriesFromEvents(
  keys: string[],
  rows: Array<{ detectedAt: Date; bucket: "missed" | "text" | "reply" }>,
): MctbAnalyticsTrendPoint[] {
  const counts = new Map(keys.map((k) => [k, 0]));
  for (const row of rows) {
    const k = dateKey(row.detectedAt);
    if (!counts.has(k)) continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return keys.map((date) => ({ date, count: counts.get(date) || 0 }));
}

export async function loadMctbAnalytics(workspaceId: string, range: MctbAnalyticsRange = "30d") {
  const prisma = getPrisma();
  const since = rangeStart(range);
  const days = rangeDays(range);
  const dayKeys = buildDailyBuckets(since, days);

  const events = await prisma.missedCallEvent.findMany({
    where: { workspaceId, detectedAt: { gte: since } },
    select: {
      status: true,
      suppressionReason: true,
      smsSentAt: true,
      callerE164: true,
      detectedAt: true,
    },
  });

  type EventRow = {
    status: string;
    suppressionReason: string | null;
    smsSentAt: Date | null;
    callerE164: string;
    detectedAt: Date;
  };

  const rows = events as EventRow[];
  const totalMissed = rows.length;
  const textsSent = rows.filter((e) => e.smsSentAt || e.status === "SENT").length;
  const suppressed = rows.filter((e) => e.status === "SUPPRESSED").length;
  const uniqueCallers = new Set(rows.map((e) => e.callerE164)).size;
  const repeatCallers = [...new Set(
    rows
      .map((e) => e.callerE164)
      .filter((phone, _i, arr) => arr.filter((p) => p === phone).length > 1),
  )].length;

  const replied = await prisma.missedCallEvent.count({
    where: { workspaceId, detectedAt: { gte: since }, status: "CUSTOMER_REPLIED" },
  });

  const linkClicks = await prisma.linkClickEvent.count({
    where: {
      workspaceId,
      createdAt: { gte: since },
      missedCallEventId: { not: null },
    },
  }).catch(() => 0);

  const linksSent = textsSent;

  const voicemailCount = await prisma.voicemailMessage.count({
    where: { workspaceId, createdAt: { gte: since } },
  }).catch(() => 0);

  const optOuts = rows.filter((e) => e.suppressionReason === "OPTED_OUT").length;
  const deliveryFailures = rows.filter((e) => e.status === "FAILED").length;

  const suppressionByReason = rows.reduce<Record<string, number>>((acc, e) => {
    if (e.status !== "SUPPRESSED" || !e.suppressionReason) return acc;
    const key = e.suppressionReason;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const missedTrendRows = rows.map((e) => ({
    detectedAt: e.detectedAt,
    bucket: "missed" as const,
  }));
  const textTrendRows = rows
    .filter((e) => e.smsSentAt || e.status === "SENT" || e.status === "CUSTOMER_REPLIED")
    .map((e) => ({
      detectedAt: e.smsSentAt || e.detectedAt,
      bucket: "text" as const,
    }));
  const replyTrendRows = rows
    .filter((e) => e.status === "CUSTOMER_REPLIED")
    .map((e) => ({ detectedAt: e.detectedAt, bucket: "reply" as const }));

  return {
    range,
    since: since.toISOString(),
    totalMissed,
    textsSent,
    suppressed,
    uniqueCallers,
    repeatCallers,
    replies: replied,
    conversationsStarted: replied,
    replyRate: textsSent > 0 ? Math.round((replied / textsSent) * 100) : 0,
    deliveryRate: totalMissed > 0 ? Math.round((textsSent / totalMissed) * 100) : 0,
    consentRate: totalMissed > 0 ? Math.round((textsSent / totalMissed) * 100) : 0,
    linkClicks,
    linksSent,
    linkClickRate: linksSent > 0 ? Math.round((linkClicks / linksSent) * 100) : 0,
    voicemailCount,
    optOuts,
    deliveryFailures,
    suppressionByReason,
    trends: {
      missedCalls: seriesFromEvents(dayKeys, missedTrendRows),
      recoveryTexts: seriesFromEvents(dayKeys, textTrendRows),
      replies: seriesFromEvents(dayKeys, replyTrendRows),
    },
  };
}
