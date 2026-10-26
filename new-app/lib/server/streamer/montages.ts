import { z } from 'zod'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'

export const montageCreateSchema = z.object({
  projectId: z.string().min(1),
  clipIds: z.array(z.string()).optional(),
  topN: z.number().int().min(1).max(20).default(5),
  maxDurationS: z.number().int().min(30).max(600).default(180),
  order: z.enum(['score', 'chronological']).default('score'),
  transition: z.enum(['cut', 'fade']).default('cut'),
  aspect: z.enum(['9:16', '16:9']).default('9:16'),
  titleCard: z.boolean().default(true),
})

export async function createMontage(workspaceId: string, input: z.infer<typeof montageCreateSchema>) {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({
    where: { id: input.projectId, workspaceId, deletedAt: null },
    include: { streamVod: true },
  })
  if (!project?.streamVod) throw new Error('Streamer project required')
  const clipIds = input.clipIds ?? []
  if (clipIds.length < 2) {
    throw new Error('Montage requires at least 2 clips')
  }
  const montageId = createId('mont')
  const title = `${project.title} montage`
  await prisma.$transaction(async (tx) => {
    await tx.clipMontage.create({
      data: {
        id: montageId,
        workspaceId,
        projectId: project.id,
        title,
        clipIds: input.clipIds ?? [],
        options: {
          topN: input.topN,
          maxDurationS: input.maxDurationS,
          order: input.order,
          transition: input.transition,
          aspect: input.aspect,
          titleCard: input.titleCard,
        },
        status: 'QUEUED',
      },
    })
    await tx.clipJob.create({
      data: {
        id: createId('job'),
        projectId: project.id,
        type: 'STREAM_MONTAGE',
        status: 'QUEUED',
        priority: 5,
        payload: { montageId },
      },
    })
  })
  return { montageId }
}

export async function listMontages(workspaceId: string, projectId: string) {
  const prisma = getPrisma()
  const storage = getClipStorage()
  const rows = await prisma.clipMontage.findMany({
    where: { workspaceId, projectId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  return Promise.all(rows.map(async (m) => ({
    id: m.id,
    title: m.title,
    status: m.status,
    durationMs: m.durationMs,
    outputUrl: m.outputKey ? await storage.createSignedDownloadUrl(m.outputKey, 3600) : null,
    posterUrl: m.posterKey ? await storage.createSignedDownloadUrl(m.posterKey, 3600) : null,
    error: m.error,
    createdAt: m.createdAt.toISOString(),
  })))
}
