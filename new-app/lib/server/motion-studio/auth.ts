import 'server-only'
import { resolveInternalUserId } from '@/lib/server/internal-user'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export type MotionStudioCaller = { userId: string; workspaceId: string }

/**
 * Motion Studio is in no-login testing mode. Resolve its pinned workspace and
 * internal operator without consulting Supabase sessions or browser identity.
 * This is deliberately isolated to Motion Studio; other app auth is unchanged.
 *
 * IMPORTANT: Reintroduce tenant-scoped auth and production usage controls
 * before making paid, publicly accessible agent production available.
 */
export async function requireMotionStudioCaller(_request?: Request): Promise<MotionStudioCaller> {
  const [workspaceId, userId] = await Promise.all([resolveWorkspaceId(), resolveInternalUserId()])
  return { userId, workspaceId }
}
