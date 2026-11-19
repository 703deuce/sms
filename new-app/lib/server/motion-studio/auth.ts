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
// Motion Studio is currently pinned to a single internal operator/workspace.
// Avoid re-querying both rows for every preview. A short TTL and singleflight
// prevent cold parallel requests from flooding Prisma; tests stay uncached.
const CALLER_CACHE_MS=5*60_000
let cachedCaller:{value:MotionStudioCaller;until:number}|null=null
let callerInflight:Promise<MotionStudioCaller>|null=null
export async function requireMotionStudioCaller(_request?: Request): Promise<MotionStudioCaller> {
  if(process.env.VITEST){
    const [workspaceId,userId]=await Promise.all([resolveWorkspaceId(),resolveInternalUserId()])
    return {userId,workspaceId}
  }
  if(cachedCaller&&cachedCaller.until>Date.now())return cachedCaller.value
  if(callerInflight)return callerInflight
  const work=(async()=>{
    const [workspaceId,userId]=await Promise.all([resolveWorkspaceId(),resolveInternalUserId()])
    const value={userId,workspaceId}
    cachedCaller={value,until:Date.now()+CALLER_CACHE_MS}
    return value
  })()
  callerInflight=work
  try{return await work}finally{if(callerInflight===work)callerInflight=null}
}
