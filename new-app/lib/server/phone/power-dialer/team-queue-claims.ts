import { getPrisma } from "@/lib/server/db";
import type { CampaignAdvancedConfig } from "./campaign-advanced";

const CLAIM_TTL_MS = 15 * 60 * 1000;

export async function purgeExpiredClaims(workspaceId: string) {
  const prisma = getPrisma();
  await prisma.powerDialerContactClaim.deleteMany({
    where: { workspaceId, expiresAt: { lt: new Date() } },
  });
}

export async function releaseSessionClaims(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  await prisma.powerDialerContactClaim.deleteMany({ where: { workspaceId, sessionId } });
}

export async function releaseContactClaim(
  workspaceId: string,
  campaignId: string,
  contactId: string,
) {
  const prisma = getPrisma();
  await prisma.powerDialerContactClaim.deleteMany({
    where: { workspaceId, campaignId, contactId },
  });
}

/** Contacts claimed by another live session (M12). */
export async function loadBlockedContactIds(
  workspaceId: string,
  campaignId: string,
  sessionId: string,
): Promise<Set<string>> {
  await purgeExpiredClaims(workspaceId);
  const prisma = getPrisma();
  const rows = await prisma.powerDialerContactClaim.findMany({
    where: {
      workspaceId,
      campaignId,
      sessionId: { not: sessionId },
      expiresAt: { gt: new Date() },
    },
    select: { contactId: true },
  });
  return new Set(rows.map((r) => r.contactId));
}

export async function claimContactForSession(input: {
  workspaceId: string;
  campaignId: string;
  contactId: string;
  sessionId: string;
  repUserId: string | null;
}) {
  await purgeExpiredClaims(input.workspaceId);
  const prisma = getPrisma();
  const expiresAt = new Date(Date.now() + CLAIM_TTL_MS);
  const existing = await prisma.powerDialerContactClaim.findUnique({
    where: { campaignId_contactId: { campaignId: input.campaignId, contactId: input.contactId } },
  });
  if (existing && existing.sessionId !== input.sessionId && existing.expiresAt > new Date()) {
    throw new Error("Contact is assigned to another rep session");
  }
  if (existing) {
    return prisma.powerDialerContactClaim.update({
      where: { id: existing.id },
      data: {
        sessionId: input.sessionId,
        repUserId: input.repUserId,
        expiresAt,
        claimedAt: new Date(),
      },
    });
  }
  return prisma.powerDialerContactClaim.create({
    data: {
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      contactId: input.contactId,
      sessionId: input.sessionId,
      repUserId: input.repUserId,
      expiresAt,
    },
  });
}

type RoundRobinState = { teamQueuePointer?: number };

export function pickRoundRobinContactIds(
  eligibleContactIds: string[],
  repUserId: string | null,
  memberUserIds: string[],
  state: RoundRobinState,
): string[] {
  if (!eligibleContactIds.length) return [];
  const reps = memberUserIds.length ? memberUserIds : repUserId ? [repUserId] : [];
  if (!reps.length) return eligibleContactIds;
  const idx = reps.indexOf(repUserId || "");
  if (idx < 0) return eligibleContactIds;
  const pointer = typeof state.teamQueuePointer === "number" ? state.teamQueuePointer : 0;
  const start = pointer % eligibleContactIds.length;
  const rotated = [...eligibleContactIds.slice(start), ...eligibleContactIds.slice(0, start)];
  return rotated;
}

export function nextRoundRobinPointer(current: number, count: number) {
  if (count <= 0) return 0;
  return (current + 1) % count;
}

export function teamModeBlocksUnclaimedPull(
  mode: CampaignAdvancedConfig["teamQueueMode"],
): boolean {
  return mode === "pull" || mode === "round_robin";
}
