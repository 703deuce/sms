import { getPrisma } from "@/lib/server/db";

export async function getPhoneAnalytics(
  workspaceId: string,
  range: "7d" | "30d" | "90d",
) {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const prisma = getPrisma();
  const calls = await prisma.humanCall.findMany({
    where: { workspaceId, startedAt: { gte: since } },
    select: {
      id: true,
      direction: true,
      status: true,
      disposition: true,
      startedAt: true,
      answeredAt: true,
      endedAt: true,
      phoneNumberId: true,
      source: true,
    },
  });

  const inbound = calls.filter((c) => c.direction === "inbound");
  const outbound = calls.filter((c) => c.direction === "outbound");
  const missed = calls.filter(
    (c) =>
      c.disposition?.includes("no_answer") ||
      c.status === "missed" ||
      c.status === "no_answer",
  );
  const answered = calls.filter((c) => c.answeredAt != null);
  const voicemail = calls.filter(
    (c) => c.status === "voicemail" || c.disposition?.includes("voicemail"),
  );

  let talkSec = 0;
  for (const c of answered) {
    if (c.answeredAt && c.endedAt) {
      talkSec += Math.max(0, Math.floor((c.endedAt.getTime() - c.answeredAt.getTime()) / 1000));
    }
  }

  const byDay = new Map<string, { inbound: number; outbound: number; missed: number }>();
  const byHour = new Map<number, number>();

  for (const c of calls) {
    const d = c.startedAt.toISOString().slice(0, 10);
    const bucket = byDay.get(d) || { inbound: 0, outbound: 0, missed: 0 };
    if (c.direction === "inbound") bucket.inbound++;
    else bucket.outbound++;
    if (missed.some((m) => m.id === c.id)) bucket.missed++;
    byDay.set(d, bucket);
    const h = c.startedAt.getUTCHours();
    byHour.set(h, (byHour.get(h) || 0) + (c.direction === "inbound" ? 1 : 0));
  }

  const trend = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, ...v }));

  const hourly = [...byHour.entries()]
    .sort(([a], [b]) => a - b)
    .map(([hour, count]) => ({
      hour: `${hour % 12 || 12}${hour < 12 ? "a" : "p"}`,
      calls: count,
    }));

  const mctbSince = since;
  const [mctbSent, mctbSuppressed, mctbReplied] = await Promise.all([
    prisma.missedCallEvent.count({
      where: { workspaceId, smsSentAt: { gte: mctbSince } },
    }),
    prisma.missedCallEvent.count({
      where: {
        workspaceId,
        detectedAt: { gte: mctbSince },
        status: "SUPPRESSED",
      },
    }),
    prisma.missedCallEvent.count({
      where: {
        workspaceId,
        detectedAt: { gte: mctbSince },
        status: "SENT",
      },
    }),
  ]);

  const campaigns = await prisma.powerDialerCampaign.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      attemptedCount: true,
      connectedCount: true,
      completedCount: true,
      totalContacts: true,
    },
  });

  return {
    totals: {
      calls: calls.length,
      inbound: inbound.length,
      outbound: outbound.length,
      answered: answered.length,
      missed: missed.length,
      voicemail: voicemail.length,
      talkSec,
      answerRate: inbound.length ? (answered.length / inbound.length) * 100 : 0,
      avgDurationSec: answered.length ? Math.round(talkSec / answered.length) : 0,
    },
    trend,
    hourly,
    campaigns,
    mctb: {
      recoveryTextsSent: mctbSent,
      suppressedRecoveries: mctbSuppressed,
      eligibleSentEvents: mctbReplied,
      replyRate: mctbSent ? 0 : 0,
    },
  };
}

export async function getOverviewMetrics(workspaceId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const prisma = getPrisma();
  const calls = await prisma.humanCall.findMany({
    where: { workspaceId, startedAt: { gte: since } },
    select: {
      direction: true,
      status: true,
      disposition: true,
      answeredAt: true,
      endedAt: true,
      from: true,
      callbackNeeded: true,
      handled: true,
    },
  });

  const inbound = calls.filter((c) => c.direction === "inbound");
  const outbound = calls.filter((c) => c.direction === "outbound");
  const missed = calls.filter(
    (c) =>
      c.disposition?.includes("no_answer") ||
      c.status === "missed" ||
      c.status === "no_answer",
  );
  const voicemail = calls.filter(
    (c) => c.status === "voicemail" || c.disposition?.includes("voicemail"),
  );
  let talkSec = 0;
  for (const c of calls) {
    if (c.answeredAt && c.endedAt) {
      talkSec += Math.max(0, Math.floor((c.endedAt.getTime() - c.answeredAt.getTime()) / 1000));
    }
  }

  return {
    inbound: inbound.length,
    outbound: outbound.length,
    missed: missed.length,
    voicemail: voicemail.length,
    talkSec,
    uniqueCallers: new Set(inbound.map((c) => c.from)).size,
    callbacksOpen: calls.filter((c) => c.callbackNeeded && !c.handled).length,
  };
}
