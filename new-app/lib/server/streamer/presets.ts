import { z } from 'zod'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'

const boxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0.05).max(1),
  h: z.number().min(0.05).max(1),
})

export const presetCreateSchema = z.object({
  channelId: z.string().optional(),
  name: z.string().min(1).max(80).default('Default'),
  layout: z.enum(['stack', 'gameplay', 'camera_follow']).default('stack'),
  facecam: boxSchema.nullable().optional(),
  gameplay: boxSchema.nullable().optional(),
  split: z.number().min(0.25).max(0.5).default(0.4),
  facecamPosition: z.enum(['top', 'bottom']).default('top'),
  makeDefault: z.boolean().optional(),
})

export async function listLayoutPresets(workspaceId: string, channelId?: string) {
  const prisma = getPrisma()
  return prisma.streamLayoutPreset.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      ...(channelId ? { OR: [{ channelId }, { channelId: null }] } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })
}

export async function createLayoutPreset(workspaceId: string, body: z.infer<typeof presetCreateSchema>) {
  const prisma = getPrisma()
  const id = createId('slp')
  const preset = await prisma.streamLayoutPreset.create({
    data: {
      id,
      workspaceId,
      channelId: body.channelId ?? null,
      name: body.name,
      layout: body.layout,
      facecam: body.facecam ?? undefined,
      gameplay: body.gameplay ?? undefined,
      split: body.split,
      facecamPosition: body.facecamPosition,
      source: 'manual',
    },
  })
  if (body.makeDefault && body.channelId) {
    await prisma.streamChannel.update({
      where: { id: body.channelId },
      data: { defaultPresetId: id },
    })
  }
  return preset
}
