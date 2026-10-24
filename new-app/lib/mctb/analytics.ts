import { getPrisma } from "@/lib/server/db";
import {
  computeFunnelCounts,
  isCustomerReplied,
  isRecoveryTextSent,
  type MissedCallAnalyticsRow,
} from "@/lib/mctb/analytics-metric-definitions";
import type { MctbAnalyticsRange } from "@/lib/mctb/analytics-range";
import {
  analyticsRangeBounds,
  loadWorkspaceTimeZone,
  workspaceCalendarDateKey,
} from "@/lib/mctb/workspace-timezone";

export type { MctbAnalyticsRange } from "@/lib/mctb/analytics-range";

export type MctbAnalyticsTrendPoint = { date: string; count: number };

function seriesFromRows(
  dayKeys: string[],
  rows: Array<{ at: Date }>,
  timeZone: string,
): MctbAnalyticsTrendPoint[] {
  const counts = new Map(dayKeys.map((k) => [k, 0]));
  for (const row of rows) {
    const k = workspaceCalendarDateKey(row.at, timeZone);
    if (!counts.has(k)) continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return dayKeys.map((date) => ({ date, count: counts.get(date) || 0 }));
}

export async function loadMctbAnalytics(workspaceId: string, range: MctbAnalyticsRange = "30d") {
  const prisma = getPrisma();
  const timeZone = await loadWorkspaceTimeZone(workspaceId);
  const { since, dayKeys } = analyticsRangeBounds(range, timeZone);

  const events = await prisma.missedCallEvent.findMany({
    where: { workspaceId, detectedAt: { gte: since } },
    select: {
      status: true,
      suppressionReason: true,
      smsSentAt: true,
      eligible: true,
      detectedAt: true,
    },
  });

  const rows = events as MissedCallAnalyticsRow[];
  const funnel = computeFunnelCounts(rows);

  const suppressionByReason = rows.reduce<Record<string, number>>((acc, e) => {
    if (!isSuppressedRow(e) || !e.suppressionReason) return acc;
    const key = e.suppressionReason;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  function isSuppressedRow(e: MissedCallAnalyticsRow) {
    return e.status.toUpperCase() === "SUPPRESSED";
  }

  const optOuts = rows.filter(
    (e) => e.suppressionReason === "OPTED_OUT" && isSuppressedRow(e),
  ).length;

  const [linkClicks, bookingLinksSent, callbackRequested, aiAssistedConversations, voicemailCount, handledLeads] =
    await Promise.all([
      prisma.linkClickEvent
        .count({
          where: {
            workspaceId,
            createdAt: { gte: since },
            missedCallEventId: { not: null },
          },
        })
        .catch(() => 0),
      prisma.mctbConversationBookingActivity
        .count({
          where: {
            workspaceId,
            kind: "BOOKING_LINK_SENT",
            createdAt: { gte: since },
          },
        })
        .catch(() => 0),
      prisma.mctbHandoffEvent
        .count({
          where: {
            workspaceId,
            eventType: "callback_requested",
            createdAt: { gte: since },
          },
        })
        .catch(() => 0),
      prisma.mctbConversationBookingActivity
        .groupBy({
          by: ["conversationId"],
          where: {
            workspaceId,
            createdAt: { gte: since },
            kind: { in: ["INTENT_IDENTIFIED", "POLICY_MATCHED", "FIELD_COLLECTED"] },
          },
        })
        .then((rows) => rows.length)
        .catch(() => 0),
      prisma.voicemailMessage
        .count({
          where: { workspaceId, createdAt: { gte: since } },
        })
        .catch(() => 0),
      prisma.mctbConversationAutomationState
        .count({
          where: {
            workspaceId,
            followUpStatus: "resolved",
            followUpAt: { gte: since },
          },
        })
        .catch(() => 0),
    ]);

  const missedTrendRows = rows.map((e) => ({ at: e.detectedAt }));
  const textTrendRows = rows
    .filter(isRecoveryTextSent)
    .map((e) => ({ at: e.smsSentAt || e.detectedAt }));
  const replyTrendRows = rows.filter(isCustomerReplied).map((e) => ({ at: e.detectedAt }));

  return {
    range,
    since: since.toISOString(),
    timeZone,
    totalMissed: funnel.totalMissed,
    eligible: funnel.eligible,
    textsSent: funnel.textsSent,
    suppressed: funnel.suppressed,
    replies: funnel.replies,
    handledLeads,
    replyRate: funnel.replyRate,
    eligibilityRate: funnel.eligibilityRate,
    sendRate: funnel.sendRate,
    deliveryFailures: funnel.deliveryFailures,
    linkClicks,
    bookingLinksSent,
    callbackRequested,
    aiAssistedConversations,
    voicemailCount,
    optOuts,
    suppressionByReason,
    trends: {
      missedCalls: seriesFromRows(dayKeys, missedTrendRows, timeZone),
      recoveryTexts: seriesFromRows(dayKeys, textTrendRows, timeZone),
      replies: seriesFromRows(dayKeys, replyTrendRows, timeZone),
    },
  };
}
