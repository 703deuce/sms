import 'server-only'
import { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { deriveEdl } from '@/lib/clips/script-edl/derive-edl'
import { outputDurationMs } from '@/lib/clips/script-edl/edl-playback'
import { getCompositionForWorkspace, parseScriptCompositionDocument } from '@/lib/server/clips/script-composition'
import { getScriptBootstrap } from '@/lib/server/clips/script-bootstrap'

export type ScriptExportSettings = {
  exportKind: 'video' | 'audio' | 'srt' | 'vtt' | 'txt' | 'md'
  resolution: '720p' | '1080p' | '4k'
  quality: 'recommended' | 'high' | 'medium' | 'low'
  burnCaptions: boolean
  includeSubtitleTrack: boolean
  includeMarkersAsChapters?: boolean
  audioFormat?: 'wav' | 'mp3'
}

export async function enqueueCompositionExport(
  workspaceId: string,
  compositionId: string,
  settings: ScriptExportSettings,
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

  if (existing && (existing.status === 'QUEUED' || existing.status === 'RENDERING')) {
    const activeJobs = await prisma.clipJob.findMany({
      where: {
        projectId: row.projectId,
        type: 'RENDER_SCRIPT_COMPOSITION',
        status: { in: ['QUEUED', 'RUNNING'] },
      },
      take: 30,
      orderBy: { createdAt: 'desc' },
    })
    const linked = activeJobs.find((j) => {
      const p = j.payload as { renderId?: string } | null
      return p?.renderId === existing.id
    })
    if (linked) {
      return { renderId: existing.id, status: existing.status }
    }
  }

  const renderId = existing?.id ?? createId('scrn')

  let edlDurationMs: number | undefined
  const bootstrap = await getScriptBootstrap(workspaceId, row.projectId)
  if (bootstrap?.editorWords?.length) {
    const document = parseScriptCompositionDocument(row.document)
    const wordsById = new Map(bootstrap.editorWords.map((w) => [w.id, w]))
    edlDurationMs = outputDurationMs(deriveEdl(document, wordsById))
  }

  const settingsWithEdl = {
    ...settings,
    ...(typeof edlDurationMs === 'number' && edlDurationMs > 0 ? { edlDurationMs } : {}),
  }

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
      settings: settingsWithEdl as Prisma.InputJsonValue,
    },
    update: {
      status: 'QUEUED',
      settings: settingsWithEdl as Prisma.InputJsonValue,
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

/** @deprecated use enqueueCompositionExport */
export const enqueueCompositionVideoExport = enqueueCompositionExport

export async function getCompositionRender(workspaceId: string, compositionId: string, renderId: string) {
  const prisma = getPrisma()
  return prisma.scriptCompositionRender.findFirst({
    where: { id: renderId, compositionId, workspaceId },
  })
}

export async function cancelCompositionExport(
  workspaceId: string,
  compositionId: string,
  renderId: string,
  reason = 'Canceled by user',
) {
  const row = await getCompositionForWorkspace(workspaceId, compositionId)
  if (!row) return null
  const render = await getCompositionRender(workspaceId, compositionId, renderId)
  if (!render) return null
  if (render.status === 'READY') return { ok: true, alreadyDone: true as const }

  const prisma = getPrisma()
  await prisma.scriptCompositionRender.update({
    where: { id: renderId },
    data: { status: 'FAILED', error: reason.slice(0, 500) },
  })
  const jobs = await prisma.clipJob.findMany({
    where: {
      projectId: row.projectId,
      type: 'RENDER_SCRIPT_COMPOSITION',
      status: { in: ['QUEUED', 'RUNNING'] },
    },
    take: 40,
    orderBy: { createdAt: 'desc' },
  })
  for (const j of jobs) {
    const p = j.payload as { renderId?: string } | null
    if (p?.renderId === renderId) {
      await prisma.clipJob.update({
        where: { id: j.id },
        data: { status: 'CANCELED', error: reason.slice(0, 500), lockedBy: null, lockedAt: null },
      })
    }
  }
  return { ok: true, alreadyDone: false as const }
}
