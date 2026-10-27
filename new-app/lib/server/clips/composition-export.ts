import 'server-only'
import { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { getCompositionForWorkspace } from '@/lib/server/clips/script-composition'

export type ScriptVideoExportSettings = {
  resolution: '720p' | '1080p' | '4k'
  quality: 'recommended' | 'high' | 'medium' | 'low'
  burnCaptions: boolean
  includeSubtitleTrack: boolean
}

export async function enqueueCompositionVideoExport(
  workspaceId: string,
  compositionId: string,
  settings: ScriptVideoExportSettings,
) {
  const row = await getCompositionForWorkspace(workspaceId, compositionId)
  if (!row) return null

  const idempotencyKey = createHash('sha256')
    .update(
      JSON.stringify({
        compositionId,
        revision: row.revision,
        settings,
      }),
    )
    .digest('hex')
    .slice(0, 32)

  const prisma = getPrisma()
  const existing = await prisma.scriptCompositionRender.findUnique({
    where: { compositionId_idempotencyKey: { compositionId, idempotencyKey } },
  })
  if (existing && existing.status === 'READY' && existing.outputKey) {
    return { renderId: existing.id, status: existing.status }
  }

  const renderId = createId('scrn')
  await prisma.scriptCompositionRender.upsert({
    where: { compositionId_idempotencyKey: { compositionId, idempotencyKey } },
    create: {
      id: renderId,
      compositionId,
      workspaceId,
      status: 'QUEUED',
      idempotencyKey,
      resolution: settings.resolution,
      aspectRatio: row.aspect ?? '9:16',
      settings: settings as Prisma.InputJsonValue,
    },
    update: {
      status: 'QUEUED',
      settings: settings as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  })

  await prisma.clipJob.create({
    data: {
      id: createId('cjob'),
      projectId: row.projectId,
      type: 'RENDER_SCRIPT_COMPOSITION',
      status: 'QUEUED',
      payload: {
        compositionId,
        renderId,
      } as Prisma.InputJsonValue,
    },
  })

  return { renderId, status: 'QUEUED' as const }
}

export async function getCompositionRender(workspaceId: string, compositionId: string, renderId: string) {
  const prisma = getPrisma()
  return prisma.scriptCompositionRender.findFirst({
    where: { id: renderId, compositionId, workspaceId },
  })
}
