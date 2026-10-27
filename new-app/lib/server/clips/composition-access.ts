import 'server-only'
import type { Role, ScriptShareRole } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { ForbiddenError } from '@/lib/server/auth/session'
import { getCompositionForWorkspace } from '@/lib/server/clips/script-composition'

const WORKSPACE_EDITOR_ROLES = new Set<Role>(['OWNER', 'ADMINISTRATOR', 'MANAGER', 'CAMPAIGN_CREATOR'])

export async function getWorkspaceMembershipRole(workspaceId: string, userId: string): Promise<Role | null> {
  const prisma = getPrisma()
  const row = await prisma.membership.findFirst({
    where: { workspaceId, userId },
    select: { role: true },
  })
  return row?.role ?? null
}

export async function isWorkspaceEditor(workspaceId: string, userId: string): Promise<boolean> {
  const role = await getWorkspaceMembershipRole(workspaceId, userId)
  return role != null && WORKSPACE_EDITOR_ROLES.has(role)
}

export async function getCompositionCollaboratorRole(
  compositionId: string,
  userId: string,
): Promise<ScriptShareRole | null> {
  const prisma = getPrisma()
  const row = await prisma.scriptCompositionCollaborator.findUnique({
    where: { compositionId_userId: { compositionId, userId } },
    select: { role: true },
  })
  return row?.role ?? null
}

/** Share settings / link management: workspace editor or composition collaborator with EDIT. */
export async function assertCanManageCompositionShare(
  workspaceId: string,
  compositionId: string,
  userId: string,
): Promise<void> {
  const row = await getCompositionForWorkspace(workspaceId, compositionId)
  if (!row) throw new ForbiddenError('Not found')

  if (await isWorkspaceEditor(workspaceId, userId)) return

  const collab = await getCompositionCollaboratorRole(compositionId, userId)
  if (collab === 'EDIT') return

  throw new ForbiddenError()
}

/** Signed-in viewer may access a gated publish/link: workspace member or any collaborator. */
export async function viewerCanAccessGatedShare(
  workspaceId: string,
  compositionId: string,
  userId: string,
): Promise<boolean> {
  const role = await getWorkspaceMembershipRole(workspaceId, userId)
  if (role) return true
  const collab = await getCompositionCollaboratorRole(compositionId, userId)
  return collab != null
}

/** Comment resolve/delete: comment author, thread creator, workspace editor, or EDIT collaborator. */
export async function assertCanModerateCommentThread(input: {
  workspaceId: string
  compositionId: string
  userId: string
  threadId: string
  commentAuthorId?: string
}): Promise<void> {
  if (input.commentAuthorId && input.commentAuthorId === input.userId) return

  const prisma = getPrisma()
  const thread = await prisma.scriptCompositionCommentThread.findFirst({
    where: { id: input.threadId, compositionId: input.compositionId },
    select: { createdById: true },
  })
  if (!thread) throw new ForbiddenError('Not found')
  if (thread.createdById === input.userId) return

  if (await isWorkspaceEditor(input.workspaceId, input.userId)) return

  const collab = await getCompositionCollaboratorRole(input.compositionId, input.userId)
  if (collab === 'EDIT' || collab === 'COMMENT') return

  throw new ForbiddenError()
}
