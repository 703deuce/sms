import { getPrisma } from "@/lib/db";

export type MctbAnalyticsRange = "7d" | "30d" | "90d";

function rangeStart(range: MctbAnalyticsRange): Date {
  const d = new Date();
  if (range === "7d") d.setDate(d.getDate() - 7);
  else if (range === "30d") d.setDate(d.getDate() - 30);
  else d.setDate(d.getDate() - 90);
  return d;
}

export async function loadMctbAnalytics(workspaceId: string, range: MctbAnalyticsRange = "30d") {
  const prisma = getPrisma();
  const since = rangeStart(range);
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
  };
}
