import 'server-only'
import { Prisma } from '@prisma/client'
import { resolveSourceMediaId } from '@/lib/clips/script-editor/to-editor-words'
import { parseScriptCompositionDocument } from '@/lib/server/clips/script-composition'
import { draftToComposition } from '@/lib/server/t2v/to-composition'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage, storageDriverName } from '@/lib/storage'
import { createId } from '@/lib/supabase/id'

export async function applyT2vAssembled(input: {
  workspaceId: string
  projectId: string
  draftId: string
  revision: number
  sourceKey: string
  durationMs: number
  sceneStartsMs: Record<string, number>
  words: Array<{ w: string; s: number; e: number; i: number; spk?: number }>
}) {
  const prisma = getPrisma()
  const draftRow = await prisma.t2vDraft.findFirst({
    where: { id: input.draftId, workspaceId: input.workspaceId, projectId: input.projectId },
  })
  if (!draftRow) throw new Error('draft_not_found')
  const doc = draftRow.document as T2vDraftV1

  const uploadId = createId('upl')
  const driver = storageDriverName()
  await prisma.clipUpload.create({
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

  const project = await prisma.clipProject.update({
    where: { id: input.projectId },
    data: {
      uploadId,
      rangeEndMs: input.durationMs,
      status: 'READY',
      stage: 'ready',
      progress: 100,
      transcriptWords: input.words as Prisma.InputJsonValue,
    },
  })

  if (project.transcriptKey) {
    await getClipStorage().putJson(project.transcriptKey, input.words)
  }

  await prisma.scriptMediaAsset.upsert({
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
  const existing = await prisma.scriptComposition.findFirst({
    where: { projectId: input.projectId, kind: 'FULL', clipId: null, deletedAt: null },
  })
  const previous = existing ? parseScriptCompositionDocument(existing.document) : null
  let musicGenerationId: string | null = null
  if (doc.music?.generationId && !doc.music.disabled) {
    const gen = await prisma.aiGeneration.findFirst({
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
    await prisma.scriptComposition.update({
      where: { id: existing.id },
      data: { document: compositionDoc as Prisma.InputJsonValue, revision: { increment: 1 } },
    })
  } else {
    await prisma.scriptComposition.create({
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

  await prisma.t2vDraft.update({
    where: { id: input.draftId },
    data: { assembledRevision: input.revision, status: 'READY', stage: 'done', progress: 100 },
  })

  return { projectId: input.projectId, uploadId }
}
