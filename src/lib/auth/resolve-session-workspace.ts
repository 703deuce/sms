import "server-only";

import { ensureProductWorkspace, resolveWorkspaceForProduct } from "@/lib/products/entitlements";
import type { ProductKey } from "@/lib/products/types";
import type { WorkspaceType } from "@/lib/workspace/types";
import { getPrisma } from "@/lib/db";
import { ensureOwnerMembershipsForOwnedWorkspaces } from "@/lib/workspace/owner-membership";

/**
 * Single path for password login, Google OAuth, and session restore:
 * resolve the workspace for an existing user without creating duplicate tenants.
 */
export async function resolveAuthenticatedWorkspace(
  userId: string,
  product: ProductKey,
): Promise<{ workspaceId: string; workspaceType: WorkspaceType }> {
  const prisma = getPrisma();
  const membershipCount = await prisma.membership.count({ where: { userId } });
  if (membershipCount === 0) {
    const owned = await prisma.workspace.count({ where: { ownerUserId: userId } });
    if (owned > 0) {
      await ensureOwnerMembershipsForOwnedWorkspaces(userId);
    }
  }

  const fromMembership = await resolveWorkspaceForProduct(userId, product);
  if (fromMembership) {
    return fromMembership;
  }

  const ownedAfter = await prisma.workspace.count({ where: { ownerUserId: userId } });
  if (ownedAfter > 0) {
    await ensureOwnerMembershipsForOwnedWorkspaces(userId);
    const retry = await resolveWorkspaceForProduct(userId, product);
    if (retry) return retry;
    return ensureProductWorkspace(userId, product);
  }

  return ensureProductWorkspace(userId, product);
}

/** True when the user has at least one membership or owned workspace row. */
export async function userHasAnyWorkspaceAccess(userId: string): Promise<boolean> {
  const prisma = getPrisma();
  const [memberships, owned] = await Promise.all([
    prisma.membership.count({ where: { userId } }),
    prisma.workspace.count({ where: { ownerUserId: userId } }),
  ]);
  return memberships > 0 || owned > 0;
}
