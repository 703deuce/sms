import { getPrisma } from "@/lib/server/db";

export async function getContactCampaignHistory(
  workspaceId: string,
  campaignId: string,
  contactId: string,
  limit = 20,
) {
  const prisma = getPrisma();
  const attempts = await prisma.powerDialerAttempt.findMany({
    where: {
      workspaceId,
      contactId,
      session: { campaignId },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      disposition: true,
      notes: true,
      status: true,
      attemptNumber: true,
      callbackAt: true,
      createdAt: true,
      sessionId: true,
    },
  });

  const callbacks = await prisma.powerDialerCallback.findMany({
    where: { workspaceId, campaignId, contactId },
    orderBy: { scheduledAt: "desc" },
    take: limit,
    select: {
      id: true,
      scheduledAt: true,
      status: true,
      notes: true,
      disposition: true,
    },
  });

  return {
    attempts: attempts.map((a) => ({
      id: a.id,
      disposition: a.disposition,
      notes: a.notes,
      status: a.status,
      attemptNumber: a.attemptNumber,
      callbackAt: a.callbackAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      sessionId: a.sessionId,
    })),
    callbacks: callbacks.map((c) => ({
      id: c.id,
      scheduledAt: c.scheduledAt.toISOString(),
      status: c.status,
      notes: c.notes,
      disposition: c.disposition,
    })),
  };
}
