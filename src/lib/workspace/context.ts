import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import type { WorkspaceType } from "@/lib/workspace/types";

export type WorkspaceContext = {
  workspaceId: string;
  workspaceType: WorkspaceType;
  workspaceName: string;
  ownerUserId: string | null;
};

export async function loadActiveWorkspaceContext(): Promise<WorkspaceContext | null> {
  const session = await getSession();
  const workspaceId = await getActiveWorkspaceId();
  if (!session || !workspaceId) return null;

  const row = await getPrisma().workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, displayName: true, type: true, ownerUserId: true },
  });
  if (!row) return null;

  return {
    workspaceId: row.id,
    workspaceType: row.type as WorkspaceType,
    workspaceName: row.displayName || row.name,
    ownerUserId: row.ownerUserId,
  };
}

export async function requireActiveWorkspaceContext(): Promise<WorkspaceContext> {
  const ctx = await loadActiveWorkspaceContext();
  if (!ctx) throw new Error("Unauthorized");
  return ctx;
}

export async function loadWorkspaceContextForUser(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceContext | null> {
  const membership = await getPrisma().membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    include: {
      workspace: {
        select: { id: true, name: true, displayName: true, type: true, ownerUserId: true },
      },
    },
  });
  if (!membership?.workspace) return null;
  const w = membership.workspace;
  return {
    workspaceId: w.id,
    workspaceType: w.type as WorkspaceType,
    workspaceName: w.displayName || w.name,
    ownerUserId: w.ownerUserId,
  };
}
