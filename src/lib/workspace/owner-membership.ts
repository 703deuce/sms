import { getPrisma } from "@/lib/db";

/**
 * Domain invariant: workspace.ownerUserId must have an OWNER Membership row.
 * Call after workspace creation paths and when reconciling legacy rows.
 */
export async function ensureOwnerMembership(userId: string, workspaceId: string): Promise<void> {
  const prisma = getPrisma();
  const existing = await prisma.membership.findFirst({
    where: { userId, workspaceId },
    select: { id: true },
  });
  if (existing) return;
  await prisma.membership.create({
    data: { userId, workspaceId, role: "OWNER" },
  });
}

/** Link every workspace this user owns (one user id, many workspaces is invalid for OAuth repeat-login). */
export async function ensureOwnerMembershipsForOwnedWorkspaces(userId: string): Promise<number> {
  const prisma = getPrisma();
  const owned = await prisma.workspace.findMany({
    where: { ownerUserId: userId },
    select: { id: true },
  });
  let created = 0;
  for (const ws of owned) {
    const before = await prisma.membership.findFirst({
      where: { userId, workspaceId: ws.id },
      select: { id: true },
    });
    if (before) continue;
    await prisma.membership.create({
      data: { userId, workspaceId: ws.id, role: "OWNER" },
    });
    created += 1;
  }
  return created;
}
