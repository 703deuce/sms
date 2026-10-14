import { redirect } from "next/navigation";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

/** Active workspace id — used as LSE `businessId` / `organizationId` in reputation tables. */
export async function getReputationWorkspaceId(): Promise<string> {
  const session = await getSession();
  if (!session) redirect("/login");

  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) redirect("/app");

  try {
    const membership = await getPrisma().membership.findFirst({
      where: { userId: session.userId, workspaceId },
    });
    if (!membership) redirect("/app");
  } catch {
    // DB unavailable — still allow page if cookie workspace is set
  }

  return workspaceId;
}

export function reputationTenantIds(workspaceId: string) {
  return { workspaceId, organizationId: workspaceId, businessId: workspaceId };
}
