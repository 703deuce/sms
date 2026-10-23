import { getPrisma } from "@/lib/server/db";
import { isHumanConversation } from "./disposition-effects";

export async function getPowerDialerSessionSummary(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  const session = await prisma.powerDialerSession.findFirst({
    where: { id: sessionId, workspaceId },
    include: { campaign: true },
  });
  if (!session) throw new Error("Session not found");

  const attempts = await prisma.powerDialerAttempt.findMany({
    where: { sessionId, workspaceId },
    select: {
      id: true,
      contactId: true,
      disposition: true,
      status: true,
      answerClassification: true,
      billableSeconds: true,
      callbackAt: true,
      failureReason: true,
      createdAt: true,
      endedAt: true,
    },
  });

  const uniqueContacts = new Set(attempts.map((a) => a.contactId)).size;
  let humanConversations = 0;
  let talkSec = 0;
  const classifications: Record<string, number> = {};
  const dispositions: Record<string, number> = {};
  let followUps = 0;
  let errors = 0;

  for (const a of attempts) {
    if (isHumanConversation(a.disposition, a.answerClassification)) humanConversations += 1;
    if (a.billableSeconds) talkSec += a.billableSeconds;
    const cls = a.answerClassification || "unknown";
    classifications[cls] = (classifications[cls] || 0) + 1;
    if (a.disposition) {
      dispositions[a.disposition] = (dispositions[a.disposition] || 0) + 1;
      if (a.disposition.toLowerCase() === "callback" || a.callbackAt) followUps += 1;
    }
    if (a.failureReason) errors += 1;
  }

  const started = session.startedAt.getTime();
  const ended = session.endedAt?.getTime() ?? Date.now();
  const sessionDurationSec = Math.max(0, Math.floor((ended - started) / 1000));

  const { counts } = await import("./campaign-rollups").then((m) =>
    m.computeCampaignEligibilityRollups(workspaceId, session.campaignId),
  );

  return {
    sessionId: session.id,
    campaignId: session.campaignId,
    campaignName: session.campaign.name,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    totalAttempts: attempts.length,
    uniqueContacts,
    humanConversations,
    classifications,
    talkSec,
    sessionDurationSec,
    followUps,
    dispositions,
    remainingEligible: counts.eligible,
    remainingByBucket: counts,
    errors,
  };
}
