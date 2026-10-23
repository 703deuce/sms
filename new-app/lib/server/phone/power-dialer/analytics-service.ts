import { getPrisma } from "@/lib/server/db";
import {
  dedupeAttemptsById,
  isHumanConversation,
} from "./metrics-definitions";

function rangeStart(range: "7d" | "30d" | "90d") {
  const d = new Date();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  d.setDate(d.getDate() - days);
  return d;
}

export async function getPowerDialerAnalytics(workspaceId: string, range: "7d" | "30d" | "90d") {
  const prisma = getPrisma();
  const from = rangeStart(range);
  const attempts = dedupeAttemptsById(
    await prisma.powerDialerAttempt.findMany({
      where: { workspaceId, createdAt: { gte: from } },
      select: {
        id: true,
        disposition: true,
        answerClassification: true,
        billableSeconds: true,
        createdAt: true,
        session: { select: { campaignId: true, repUserId: true } },
        humanCall: { select: { phoneNumberId: true, answeredAt: true } },
      },
    }),
  );

  let human = 0;
  let screened = 0;
  let attemptsCount = attempts.length;
  let billableSec = 0;
  const byCampaign = new Map<string, { attempts: number; human: number }>();
  const byRep = new Map<string, { attempts: number; human: number }>();
  const byNumber = new Map<string, { attempts: number; human: number }>();
  const byDay = new Map<string, number>();

  for (const a of attempts) {
    if (isHumanConversation(a.disposition, a.answerClassification)) human += 1;
    if (a.answerClassification === "screener") screened += 1;
    if (a.billableSeconds) billableSec += a.billableSeconds;
    const day = a.createdAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + 1);
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
  };
}
