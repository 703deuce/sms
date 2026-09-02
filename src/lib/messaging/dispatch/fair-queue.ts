import "server-only";

import { getPrisma } from "@/lib/db";

export type DueCampaignMessage = {
  id: string;
  workspaceId: string;
  campaignId: string;
  channel: string;
  scheduledFor: Date;
};

/**
 * Select due campaign messages with fair tenant round-robin so one large
 * campaign cannot starve other workspaces.
 */
export async function selectDueCampaignMessagesFairly(
  limit: number,
  workspaceId?: string,
): Promise<DueCampaignMessage[]> {
  const prisma = getPrisma();
  const now = new Date();

  if (workspaceId) {
    return prisma.campaignMessage.findMany({
      where: {
        workspaceId,
        status: "queued",
        scheduledFor: { lte: now },
        campaign: { status: "SENDING" },
      },
      orderBy: { scheduledFor: "asc" },
      take: limit,
      select: {
        id: true,
        workspaceId: true,
        campaignId: true,
        channel: true,
        scheduledFor: true,
      },
    });
  }

  const pool = await prisma.campaignMessage.findMany({
    where: {
      status: "queued",
      scheduledFor: { lte: now },
      campaign: { status: "SENDING" },
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    take: Math.min(limit * 8, 500),
    select: {
      id: true,
      workspaceId: true,
      campaignId: true,
      channel: true,
      scheduledFor: true,
    },
  });

  if (!pool.length) return [];

  const byWorkspace = new Map<string, DueCampaignMessage[]>();
  for (const row of pool) {
    const bucket = byWorkspace.get(row.workspaceId) ?? [];
    bucket.push(row);
    byWorkspace.set(row.workspaceId, bucket);
  }

  const workspaceIds = [...byWorkspace.keys()].sort();
  const selected: DueCampaignMessage[] = [];
  let round = 0;
  while (selected.length < limit && round < limit * workspaceIds.length) {
    for (const wsId of workspaceIds) {
      const bucket = byWorkspace.get(wsId);
      if (!bucket?.length) continue;
      selected.push(bucket.shift()!);
      if (selected.length >= limit) break;
    }
    round += 1;
  }

  return selected.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
}
