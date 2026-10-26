import type { Prisma } from '@prisma/client'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'

export async function listCaptionPresets(workspaceId: string) {
  const prisma = getPrisma()
  return prisma.captionPreset.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function createCaptionPreset(workspaceId: string, name: string, config: Record<string, unknown>) {
  const prisma = getPrisma()
  return prisma.captionPreset.create({
    data: {
      id: createId('cpre'),
      workspaceId,
      name: name.trim(),
      config: config as Prisma.InputJsonValue,
    },
  })
}

export async function deleteCaptionPreset(workspaceId: string, id: string) {
  const prisma = getPrisma()
  const row = await prisma.captionPreset.findFirst({ where: { id, workspaceId } })
  if (!row) throw new Error('Not found')
  await prisma.captionPreset.delete({ where: { id } })
}
