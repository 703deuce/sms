import 'server-only'

import { getAuthenticatedUser } from '@/lib/server/auth/session'
import { resolveInternalUserId } from '@/lib/server/internal-user'

/**
 * Actor id for clips composition APIs in prod: Supabase user when configured and signed in,
 * otherwise the workspace operator (same as comment POST / editor-preferences).
 */
export async function resolveClipsActorUserId(request?: Request): Promise<string> {
  const auth = await getAuthenticatedUser(request)
  if (auth?.id) return auth.id
  return resolveInternalUserId()
}
