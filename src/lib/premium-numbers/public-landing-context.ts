import { getPrisma } from "@/lib/db";

export type PublicLandingSearchContext = {
  workspaceId: string;
  userId: string;
};

let cachedContext: PublicLandingSearchContext | null = null;

/**
 * System workspace/user for anonymous public landing searches and reservations.
 * Configure PUBLIC_NUMBERS_LANDING_WORKSPACE_ID + PUBLIC_NUMBERS_LANDING_USER_ID in production.
 */
export async function getPublicLandingSearchContext(): Promise<PublicLandingSearchContext> {
  if (cachedContext) return cachedContext;

  const envWorkspace = process.env.PUBLIC_NUMBERS_LANDING_WORKSPACE_ID?.trim();
  const envUser = process.env.PUBLIC_NUMBERS_LANDING_USER_ID?.trim();
  if (envWorkspace && envUser) {
    cachedContext = { workspaceId: envWorkspace, userId: envUser };
    return cachedContext;
  }

  const prisma = getPrisma();
  const membership = await prisma.membership.findFirst({
    orderBy: { id: "asc" },
    select: { workspaceId: true, userId: true },
  });
  if (!membership) {
    throw new Error(
      "Public numbers landing requires PUBLIC_NUMBERS_LANDING_WORKSPACE_ID and PUBLIC_NUMBERS_LANDING_USER_ID",
    );
  }

  cachedContext = {
    workspaceId: membership.workspaceId,
    userId: membership.userId,
  };
  return cachedContext;
}
