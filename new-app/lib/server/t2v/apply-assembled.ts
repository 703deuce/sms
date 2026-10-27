import 'server-only'
import { Prisma } from '@prisma/client'
import { resolveSourceMediaId } from '@/lib/clips/script-editor/to-editor-words'
import { parseScriptCompositionDocument } from '@/lib/server/clips/script-composition'
import { draftToComposition } from '@/lib/server/t2v/to-composition'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { getPrisma } from '@/lib/server/db'
import { deleteClipStorageObjectIfOrphan } from '@/lib/server/storage/delete-object'
import { projectHasQueuedOrRunningRenderOrExport } from '@/lib/server/t2v/project-active-renders'
import { isT2vAssembledSourceKey } from '@/lib/server/t2v/source-key'
import { getClipStorage, storageDriverName } from '@/lib/storage'
import { createId } from '@/lib/supabase/id'

export async function applyT2vAssembled(input: {
  workspaceId: string
  projectId: string
  draftId: string
  revision: number
  jobId?: string
  sourceKey: string
  durationMs: number
  sceneStartsMs: Record<string, number>
  words: Array<{ w: string; s: number; e: number; i: number; spk?: number }>
}) {
  const prisma = getPrisma()

  if (!isT2vAssembledSourceKey(input.workspaceId, input.projectId, input.sourceKey)) {
    throw new Error('invalid_source_key')
  }

  if (input.jobId) {
    const job = await prisma.clipJob.findUnique({
      where: { id: input.jobId },
      select: { id: true, status: true, error: true, createdAt: true, type: true },
    })
    if (!job || job.type !== 'T2V_ASSEMBLE' || job.status === 'FAILED') {
      return { skipped: true as const, reason: 'job_failed' }
    }
    if (job.error?.includes('Canceled')) {
      return { skipped: true as const, reason: 'job_canceled' }
    }
    const newer = await prisma.clipJob.findFirst({
      where: {
        projectId: input.projectId,
        type: 'T2V_ASSEMBLE',
        createdAt: { gt: job.createdAt },
        NOT: { id: input.jobId },
      },
      select: { id: true },
    })
    if (newer) return { skipped: true as const, reason: 'superseded' }
  }

  const draftRow = await prisma.t2vDraft.findFirst({
    where: { id: input.draftId, workspaceId: input.workspaceId, projectId: input.projectId },
  })
  if (!draftRow) throw new Error('draft_not_found')

  if (draftRow.assembledRevision != null && input.revision <= draftRow.assembledRevision) {
    await prisma.t2vDraft.update({
      where: { id: input.draftId },
      data: { status: 'READY', stage: 'done', progress: 100, error: null },
    })
    return { skipped: true as const, reason: 'already_applied' }
  }

  const doc = draftRow.document as T2vDraftV1
  const driver = storageDriverName()
  const uploadId = createId('upl')

  let priorSourceKey: string | null = null
  let priorSourceDriver: string | null = null

  const result = await prisma.$transaction(async (tx) => {
    const prevProject = await tx.clipProject.findFirst({
      where: { id: input.projectId, workspaceId: input.workspaceId },
      select: { uploadId: true },
    })
    if (prevProject?.uploadId) {
      const oldUpl = await tx.clipUpload.findFirst({
        where: { id: prevProject.uploadId, workspaceId: input.workspaceId },
        select: { id: true, key: true, kind: true, storageDriver: true },
      })
      if (oldUpl?.kind === 't2v_source' && oldUpl.key && oldUpl.key !== input.sourceKey) {
        priorSourceKey = oldUpl.key
        priorSourceDriver = oldUpl.storageDriver
        await tx.clipUpload.deleteMany({ where: { id: oldUpl.id, workspaceId: input.workspaceId } })
      }
    }

    await tx.clipUpload.create({
      data: {
        id: uploadId,
        workspaceId: input.workspaceId,
        key: input.sourceKey,
        filename: 't2v-source.mp4',
        bytes: BigInt(0),
        mime: 'video/mp4',
        durationMs: input.durationMs,
        status: 'COMPLETE',
        kind: 't2v_source',
        storageDriver: driver,
      },
    })

    const project = await tx.clipProject.update({
      where: { id: input.projectId },
      data: {
        uploadId,
        rangeEndMs: input.durationMs,
        status: 'READY',
        stage: 'ready',
        progress: 100,
        transcriptWords: input.words as Prisma.InputJsonValue,
      },
      select: { id: true, title: true, transcriptKey: true },
    })

    await tx.scriptMediaAsset.upsert({
      where: { projectId: input.projectId },
      create: {
        id: createId('sma'),
        projectId: input.projectId,
        workspaceId: input.workspaceId,
        durationMs: input.durationMs,
        sourceKey: input.sourceKey,
      },
      update: { durationMs: input.durationMs, sourceKey: input.sourceKey },
    })

    const sourceMediaId = resolveSourceMediaId({ id: project.id, uploadId })
    const existing = await tx.scriptComposition.findFirst({
      where: { projectId: input.projectId, kind: 'FULL', clipId: null, deletedAt: null },
    })
    const previous = existing ? parseScriptCompositionDocument(existing.document) : null
    let musicGenerationId: string | null = null
    if (doc.music?.generationId && !doc.music.disabled) {
      const gen = await tx.aiGeneration.findFirst({
        where: { id: doc.music.generationId, workspaceId: input.workspaceId, kind: 'MUSIC', status: 'READY' },
        select: { id: true },
      })
      musicGenerationId = gen?.id ?? null
    }
    const compositionDoc = draftToComposition({
      draft: doc,
      sourceMediaId,
      words: input.words,
      sceneStartsMs: input.sceneStartsMs,
      durationMs: input.durationMs,
      musicGenerationId,
      previous,
    })

    if (existing) {
      await tx.scriptComposition.update({
        where: { id: existing.id },
        data: { document: compositionDoc as Prisma.InputJsonValue, revision: { increment: 1 } },
      })
    } else {
      await tx.scriptComposition.create({
        data: {
          id: createId('scmp'),
          projectId: input.projectId,
          workspaceId: input.workspaceId,
          kind: 'FULL',
          title: doc.title || project.title,
          document: compositionDoc as Prisma.InputJsonValue,
          revision: 0,
        },
      })
    }

    await tx.t2vDraft.update({
      where: { id: input.draftId },
      data: {
        assembledRevision: input.revision,
        status: 'READY',
        stage: 'done',
        progress: 100,
        error: null,
        musicReadyGenerationId: null,
      },
    })

    return { project }
  })

  if (result.project.transcriptKey) {
    await getClipStorage().putJson(result.project.transcriptKey, input.words)
  }

  if (
    priorSourceKey &&
    priorSourceKey !== input.sourceKey &&
    isT2vAssembledSourceKey(input.workspaceId, input.projectId, priorSourceKey)
  ) {
    const deferDelete = await projectHasQueuedOrRunningRenderOrExport(prisma, input.projectId)
    if (!deferDelete) {
      void deleteClipStorageObjectIfOrphan(priorSourceKey, priorSourceDriver).catch(() => {})
    }
  }

  return { projectId: input.projectId, uploadId }
}
