import 'server-only'
import type { Prisma } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { StyleProfileSchema, type StyleProfile } from '@/lib/clips/motion-graphics/contract'

export async function listMotionStyles(workspaceId: string) {
  const rows = await getPrisma().motionStyleProfile.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { updatedAt: 'desc' }, take: 100,
  })
  return rows.flatMap(row => {
    const parsed = StyleProfileSchema.safeParse(row.data)
    return parsed.success ? [{ ...parsed.data, updatedAt: row.updatedAt.toISOString() }] : []
  })
}
export async function getMotionStyle(workspaceId: string, id: string): Promise<StyleProfile | null> {
  const row = await getPrisma().motionStyleProfile.findFirst({
    where: { id, workspaceId, deletedAt: null },
  })
  if (!row) return null
  const parsed = StyleProfileSchema.safeParse(row.data)
  return parsed.success ? parsed.data : null
}
export async function createMotionStyle(workspaceId: string, value: Omit<StyleProfile, 'id'>) {
  const id = createId('mstyle')
  const parsed = StyleProfileSchema.parse({ ...value, id })
  await getPrisma().motionStyleProfile.create({
    data: { id, workspaceId, name: parsed.name, data: parsed as unknown as Prisma.InputJsonValue },
  })
  return parsed
}
export async function updateMotionStyle(workspaceId: string, id: string, value: Omit<StyleProfile, 'id'>) {
  const parsed = StyleProfileSchema.parse({ ...value, id })
  const result = await getPrisma().motionStyleProfile.updateMany({
    where: { id, workspaceId, deletedAt: null },
    data: { name: parsed.name, data: parsed as unknown as Prisma.InputJsonValue },
  })
  return result.count > 0 ? parsed : null
}
export async function deleteMotionStyle(workspaceId: string, id: string) {
  const result = await getPrisma().motionStyleProfile.updateMany({
    where: { id, workspaceId, deletedAt: null },
    data: { deletedAt: new Date() },
  })
  return result.count > 0
}
