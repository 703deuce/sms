import 'server-only'
import { resolveClipsActorUserId } from '@/lib/server/clips/clips-auth'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export type MotionStudioCaller = { userId: string; workspaceId: string }

/**
 * Same caller resolution as the rest of the app (clips): the pinned/default workspace,
 * and a signed-in user when one exists, otherwise the default workspace operator.
 * Motion Studio has no separate login or session gate — a missing session is not a 401.
 */
export async function requireMotionStudioCaller(request?: Request): Promise<MotionStudioCaller> {
  const [workspaceId, userId] = await Promise.all([resolveWorkspaceId(), resolveClipsActorUserId(request)])
  return { userId, workspaceId }
}
