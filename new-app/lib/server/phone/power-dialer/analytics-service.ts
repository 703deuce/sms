import { getPrisma } from "@/lib/server/db";
import { parseStoredIntelligence } from "./call-intelligence";
import {
  dedupeAttemptsById,
  isHumanConversation,
} from "./metrics-definitions";

type AnalyticsAttemptRow = {
  id: string;
  disposition: string | null;
  answerClassification: string | null;
  billableSeconds: number | null;
  createdAt: Date;
  session: { campaignId: string; repUserId: string | null };
  endedAt: Date | null;
  dispositionEffectsAt: Date | null;
  humanCall: { phoneNumberId: string | null; answeredAt: Date | null } | null;
};

function rangeStart(range: "7d" | "30d" | "90d") {
  const d = new Date();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  d.setDate(d.getDate() - days);
  return d;
}

export async function getPowerDialerAnalytics(
  workspaceId: string,
  range: "7d" | "30d" | "90d",
  repUserIdFilter?: string | null,
) {
  const prisma = getPrisma();
  const from = rangeStart(range);
  const attempts: AnalyticsAttemptRow[] = dedupeAttemptsById(
    await prisma.powerDialerAttempt.findMany({
      where: {
        workspaceId,
        createdAt: { gte: from },
        ...(repUserIdFilter ? { session: { repUserId: repUserIdFilter } } : {}),
      },
      select: {
        id: true,
        disposition: true,
        answerClassification: true,
        billableSeconds: true,
        createdAt: true,
        session: { select: { campaignId: true, repUserId: true } },
        endedAt: true,
        dispositionEffectsAt: true,
        humanCall: { select: { phoneNumberId: true, answeredAt: true } },
      },
    }),
  );

  let human = 0;
  let screened = 0;
  let machine = 0;
  let unclassified = 0;
  let answeredSignals = 0;
  let attemptsCount = attempts.length;
  let billableSec = 0;
  const byCampaign = new Map<string, { attempts: number; human: number }>();
  const byRep = new Map<string, { attempts: number; human: number }>();
  const byNumber = new Map<string, { attempts: number; human: number }>();
  const byDay = new Map<string, number>();
  const byHour = new Map<number, number>();
  const byDisposition = new Map<string, number>();
  let connected = 0;
  let conversations = 0;
  let outcomes = 0;
  let wrapSec = 0;
  let talkSec = 0;

  for (const a of attempts) {
    if (isHumanConversation(a.disposition, a.answerClassification)) human += 1;
    if (a.answerClassification === "screener") screened += 1;
    if (
      a.answerClassification === "voicemail" ||
      a.answerClassification === "machine" ||
      a.answerClassification === "ivr" ||
      a.answerClassification === "fax"
    ) {
      machine += 1;
    }
    if (!a.answerClassification || a.answerClassification === "uncertain" || a.answerClassification === "no_answer") {
      if (a.humanCall?.answeredAt) unclassified += 1;
    }
    if (a.humanCall?.answeredAt || a.answerClassification === "human" || a.answerClassification === "screener" || a.answerClassification === "voicemail") {
      answeredSignals += 1;
    }
    if (a.billableSeconds) billableSec += a.billableSeconds;
    if (isHumanConversation(a.disposition, a.answerClassification)) connected += 1;
    if (isHumanConversation(a.disposition, a.answerClassification)) conversations += 1;
    if (a.disposition) outcomes += 1;
    if (a.billableSeconds) talkSec += a.billableSeconds;
    if (a.endedAt && a.dispositionEffectsAt) {
      wrapSec += Math.max(
        0,
        Math.round((a.dispositionEffectsAt.getTime() - a.endedAt.getTime()) / 1000),
      );
    }
    const day = a.createdAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + 1);
    const hour = a.createdAt.getUTCHours();
    byHour.set(hour, (byHour.get(hour) || 0) + 1);
    const disp = a.disposition || "No disposition";
    byDisposition.set(disp, (byDisposition.get(disp) || 0) + 1);
    const cid = a.session.campaignId;
    const cBucket = byCampaign.get(cid) || { attempts: 0, human: 0 };
    cBucket.attempts += 1;
    if (isHumanConversation(a.disposition, a.answerClassification)) cBucket.human += 1;
    byCampaign.set(cid, cBucket);
    const rid = a.session.repUserId || "unassigned";
    const rBucket = byRep.get(rid) || { attempts: 0, human: 0 };
    rBucket.attempts += 1;
    if (isHumanConversation(a.disposition, a.answerClassification)) rBucket.human += 1;
    byRep.set(rid, rBucket);
    const nid = a.humanCall?.phoneNumberId || "unknown";
    const nBucket = byNumber.get(nid) || { attempts: 0, human: 0 };
    nBucket.attempts += 1;
    if (isHumanConversation(a.disposition, a.answerClassification)) nBucket.human += 1;
    byNumber.set(nid, nBucket);
  }

  const campaigns = await prisma.powerDialerCampaign.findMany({
    where: { workspaceId, id: { in: [...byCampaign.keys()] } },
    select: { id: true, name: true },
  });
  const nameById = new Map(campaigns.map((c) => [c.id, c.name]));

  return {
    range,
    totals: {
      attempts: attemptsCount,
      humanConversations: human,
      screeningEvents: screened,
      billableMinutes: Math.round(billableSec / 60),
      humanRate: attemptsCount ? Math.round((human / attemptsCount) * 1000) / 10 : 0,
    },
    trend: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({
      day,
      attempts: count,
    })),
    campaigns: [...byCampaign.entries()].map(([id, v]) => ({
      id,
      name: nameById.get(id) || id,
      attempts: v.attempts,
      humanConversations: v.human,
    })),
    representatives: [...byRep.entries()].map(([id, v]) => ({
      userId: id,
      attempts: v.attempts,
      humanConversations: v.human,
    })),
    numbers: [...byNumber.entries()].map(([id, v]) => ({
      phoneNumberId: id,
      attempts: v.attempts,
      humanConversations: v.human,
    })),
    screening: {
      detected: screened,
      uncertain: attempts.filter((a) => a.answerClassification === "uncertain").length,
    },
    pickup: {
      denominator: answeredSignals,
      human,
      machine,
      screener: screened,
      unclassified,
      humanRate: answeredSignals ? Math.round((human / answeredSignals) * 1000) / 10 : 0,
      machineRate: answeredSignals ? Math.round((machine / answeredSignals) * 1000) / 10 : 0,
    },
    funnel: {
      dialed: attemptsCount,
      connected,
      conversations,
      outcomes,
    },
    dispositions: [...byDisposition.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count })),
    byHour: [...byHour.entries()]
      .sort(([a], [b]) => a - b)
      .map(([hour, count]) => ({ hour, attempts: count })),
    productivity: {
      talkMinutes: Math.round(talkSec / 60),
      wrapMinutes: Math.round(wrapSec / 60),
      callsPerHour:
        attemptsCount && range === "7d"
          ? Math.round((attemptsCount / (7 * 24)) * 10) / 10
          : attemptsCount && range === "30d"
            ? Math.round((attemptsCount / (30 * 24)) * 10) / 10
            : attemptsCount
              ? Math.round((attemptsCount / (90 * 24)) * 10) / 10
              : 0,
    },
    leaderboard: [...byRep.entries()]
      .map(([userId, v]) => ({
        userId,
        attempts: v.attempts,
        humanConversations: v.human,
        connectRate: v.attempts ? Math.round((v.human / v.attempts) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.humanConversations - a.humanConversations),
  };
}

export async function getLiveDialerBoard(workspaceId: string) {
  const prisma = getPrisma();
  const sessions = await prisma.powerDialerSession.findMany({
    where: { workspaceId, status: { in: ["active", "paused"] }, endedAt: null },
    include: {
      campaign: { select: { id: true, name: true } },
      attempts: {
        where: { status: { in: ["pending", "ringing", "answered", "in_progress"] } },
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, contactId: true },
      },
    },
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  return sessions.map((s) => ({
    sessionId: s.id,
    campaignId: s.campaignId,
    campaignName: s.campaign.name,
    repUserId: s.repUserId,
    status: s.status,
    progressionPhase: s.progressionPhase,
    startedAt: s.startedAt,
    currentAttempt: s.attempts[0] || null,
  }));
}

export async function getAttemptCallReview(workspaceId: string, attemptId: string) {
  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: attemptId, workspaceId },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
      session: { select: { campaignId: true, repUserId: true } },
      humanCall: {
        select: {
          id: true,
          recordingUrl: true,
          transcriptText: true,
          aiSummary: true,
          source: true,
          startedAt: true,
          endedAt: true,
        },
      },
    },
  });
  if (!attempt) throw new Error("Attempt not found");
  const deepgramReady = Boolean(process.env.DEEPGRAM_API_KEY?.trim());
  const parsedIntel = parseStoredIntelligence(attempt.humanCall?.aiSummary ?? null);
  return {
    attempt,
    intelligence: {
      transcriptAvailable: Boolean(attempt.humanCall?.transcriptText),
      summaryAvailable: Boolean(parsedIntel?.summary),
      structured: parsedIntel,
      deepgramConfigured: deepgramReady,
      gate: deepgramReady
        ? null
        : "Set DEEPGRAM_API_KEY to generate transcripts for call review scoring.",
    },
    supervisor: {
      listen: false,
      whisper: false,
      barge: false,
      externalGate:
        "Listen/whisper/barge requires a Telnyx supervisor monitor leg on the power-dialer WebRTC path — not provisioned in this release.",
    },
  };
}

export function attemptsToCsvRows(
  attempts: Array<{
    id: string;
    createdAt: Date;
    disposition: string | null;
    billableSeconds: number | null;
    session: { campaignId: string; repUserId: string | null };
  }>,
) {
  const header = "attempt_id,created_at,campaign_id,rep_user_id,disposition,billable_seconds\n";
  const lines = attempts.map((a) =>
    [
      a.id,
      a.createdAt.toISOString(),
      a.session.campaignId,
      a.session.repUserId || "",
      (a.disposition || "").replace(/,/g, " "),
      a.billableSeconds ?? "",
    ].join(","),
  );
  return header + lines.join("\n");
}

export function sessionsToCsvRows(
  sessions: Array<{
    id: string;
    startedAt: Date;
    endedAt: Date | null;
    status: string;
    repUserId: string | null;
    campaignId: string;
    _count?: { attempts: number };
  }>,
) {
  const header = "session_id,started_at,ended_at,status,campaign_id,rep_user_id,attempts\n";
  const lines = sessions.map((s) =>
    [
      s.id,
      s.startedAt.toISOString(),
      s.endedAt?.toISOString() || "",
      s.status,
      s.campaignId,
      s.repUserId || "",
      s._count?.attempts ?? "",
    ].join(","),
  );
  return header + lines.join("\n");
}
