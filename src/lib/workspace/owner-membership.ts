import { getPrisma } from "@/lib/db";
import type { ProductKey } from "@/lib/products/types";
import type { WorkspaceType } from "@/lib/workspace/types";

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

/**
 * Existing user with ownerUserId workspaces: restore memberships and pick one workspace.
 * Never creates a new workspace.
 */
export async function resolveOwnedWorkspaceForUser(
  userId: string,
  product: ProductKey,
): Promise<{ workspaceId: string; workspaceType: WorkspaceType } | null> {
  const prisma = getPrisma();
  const preferredType: WorkspaceType = product === "numbers" ? "PERSONAL" : "BUSINESS";
  const owned = await prisma.workspace.findMany({
    where: { ownerUserId: userId },
    select: { id: true, type: true },
  });
  if (!owned.length) return null;

  await ensureOwnerMembershipsForOwnedWorkspaces(userId);

  let best = owned[0]!;
  let bestScore = -1;
  for (const ws of owned) {
    const phoneCount = await prisma.phoneNumber.count({ where: { workspaceId: ws.id } });
    const mctbFeature = await prisma.workspaceProductFeature
      .findFirst({
        where: { workspaceId: ws.id, featureKey: "MCTB", status: "ACTIVE" },
        select: { id: true },
      })
      .catch(() => null);
    const typeBonus =
      ws.type === preferredType ? 500 : ws.type === "BUSINESS" && product === "voice" ? 300 : 0;
    const score = typeBonus + (mctbFeature ? 1000 : 0) + phoneCount * 10;
    if (score > bestScore) {
      bestScore = score;
      best = ws;
    }
  }

  return {
    workspaceId: best.id,
    workspaceType: best.type === "PERSONAL" ? "PERSONAL" : "BUSINESS",
  };
}
