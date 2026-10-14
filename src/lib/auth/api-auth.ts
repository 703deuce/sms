import { getSession, getActiveWorkspaceId } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

/**
 * Reputation APIs use `businessId` in the path — in Transovo SMS that is the workspace id.
 */
export async function requireBusinessAccess(businessId: string): Promise<{
  userId: string;
  organizationId: string;
}> {
  const session = await getSession();
  if (!session) throw new Error("Authentication required");

  const activeWorkspaceId = await getActiveWorkspaceId();
  const workspaceId = businessId.trim();

  if (workspaceId !== activeWorkspaceId) {
    const membership = await getPrisma().membership.findFirst({
      where: { userId: session.userId, workspaceId },
    });
    if (!membership) throw new Error("Business not found or access denied");
  }

  return { userId: session.userId, organizationId: workspaceId };
}

export async function requireScanAccess(_scanId: string): Promise<{
  organizationId: string;
  businessId: string;
}> {
  throw new Error("Scan access is not available in Transovo SMS reputation module");
}
