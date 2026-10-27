import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'

export const STREAMER_DEFAULT_MONTHLY_HOURS = 40
/** One-shot paste VOD link cap (marathon/connected bypasses). */
export const STREAMER_PASTE_MAX_VOD_HOURS = 10
export const STREAMER_MAX_VOD_HOURS = STREAMER_PASTE_MAX_VOD_HOURS

export type StreamerLimits = {
  monthlyHours: number | null
  priority: number
}

export async function getStreamerLimits(workspaceId: string): Promise<StreamerLimits> {
  const prisma = getPrisma()
  const row = await prisma.workspaceLimits.findUnique({ where: { workspaceId } })
  const limits = (row?.limits ?? {}) as Record<string, unknown>
  const streamer = (limits.streamer ?? {}) as Record<string, unknown>
  const monthlyHours =
    streamer.monthlyHours === undefined
      ? STREAMER_DEFAULT_MONTHLY_HOURS
      : streamer.monthlyHours === null
        ? null
        : Number(streamer.monthlyHours)
  const priority = Number(streamer.priority ?? 0)
  return { monthlyHours, priority: Math.max(-10, Math.min(10, priority)) }
}

export async function mergeStreamerLimits(
  workspaceId: string,
  patch: Partial<StreamerLimits>,
): Promise<StreamerLimits> {
  const prisma = getPrisma()
  const current = await getStreamerLimits(workspaceId)
  const next: StreamerLimits = {
    monthlyHours: patch.monthlyHours !== undefined ? patch.monthlyHours : current.monthlyHours,
    priority: patch.priority !== undefined ? patch.priority : current.priority,
  }
  const row = await prisma.workspaceLimits.findUnique({ where: { workspaceId } })
  const limits = (row?.limits ?? {}) as Record<string, unknown>
  await prisma.workspaceLimits.upsert({
    where: { workspaceId },
    create: {
      id: createId('wlim'),
      workspaceId,
      limits: { ...limits, streamer: next },
    },
    update: {
      limits: { ...limits, streamer: next },
    },
  })
  return next
}
