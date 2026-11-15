import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { getAuthenticatedUser } from '@/lib/server/auth/session'
import { isSupabaseAuthConfigured } from '@/lib/server/supabase/env'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { MotionStudioError } from '@/lib/server/motion-studio/errors'

export type MotionStudioCaller = { userId: string; workspaceId: string }

/**
 * Motion Studio-only auth (does not change Ad Studio / clips behaviour):
 * - a signed-in session is REQUIRED (401 otherwise); the dev bypass is refused in production;
 * - the workspace is one the caller is a member of. The app's pinned clips workspace is preferred when the
 *   caller belongs to it (so uploads made through the existing clips upload path line up); otherwise the
 *   caller's oldest membership. No membership -> 403.
 */
export async function requireMotionStudioCaller(request: Request): Promise<MotionStudioCaller> {
  if (!isSupabaseAuthConfigured() && process.env.NODE_ENV === 'production')
    throw new MotionStudioError('UNAUTHENTICATED', 'Sign in to use Motion Studio.', 401)
  const user = await getAuthenticatedUser(request)
  if (!user?.id) throw new MotionStudioError('UNAUTHENTICATED', 'Sign in to use Motion Studio.', 401)
  const memberships = await getPrisma().membership.findMany({ where: { userId: user.id }, select: { workspaceId: true }, orderBy: { id: 'asc' } })
  if (!memberships.length) throw new MotionStudioError('FORBIDDEN', 'Your account has no workspace.', 403)
  let workspaceId = memberships[0].workspaceId
  try {
    const pinned = await resolveWorkspaceId()
    if (memberships.some(m => m.workspaceId === pinned)) workspaceId = pinned
  } catch {
    /* pinned workspace unavailable: keep the caller's own membership */
  }
  return { userId: user.id, workspaceId }
}
