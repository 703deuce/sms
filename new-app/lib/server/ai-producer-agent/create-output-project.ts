import 'server-only'

import type { Prisma } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'

export async function createAiProducerOutputProject(a: {
  workspaceId: string
  createdById: string
  runId: string
  title: string
  sourceProjectId: string
  clipStartMs: number
  clipEndMs: number
}): Promise<{ projectId: string; clipId: string }> {
  const prisma = getPrisma()
  const p = await prisma.clipProject.findFirstOrThrow({
    where: { id: a.sourceProjectId, workspaceId: a.workspaceId, deletedAt: null },
  })
  const projectId = createId('proj')
  const clipId = createId('clip')
  await prisma.$transaction(async (tx) => {
    await tx.clipProject.create({
      data: {
        id: projectId,
        workspaceId: a.workspaceId,
        createdById: a.createdById,
        title: a.title,
        uploadId: p.uploadId,
        sourceUrl: p.sourceUrl,
        settings: { ...((p.settings ?? {}) as object), aiProducerRunId: a.runId } as Prisma.InputJsonValue,
        rangeStartMs: p.rangeStartMs,
        rangeEndMs: p.rangeEndMs,
        status: p.status,
        stage: p.stage,
        progress: p.progress,
        transcriptKey: p.transcriptKey,
        transcriptWords: p.transcriptWords ?? undefined,
        proxyKey: p.proxyKey,
        thumbKey: p.thumbKey,
        folderId: p.folderId,
      },
    })
    await tx.clip.create({
      data: {
        id: clipId,
        projectId,
        workspaceId: a.workspaceId,
        title: a.title,
        reason: 'ai_producer',
        startMs: a.clipStartMs,
        endMs: a.clipEndMs,
        edits: {},
        editsSaveVersion: 0,
        aiMeta: { aiProducerRunId: a.runId },
        score: 0,
        scores: {},
      },
    })
  })
  return { projectId, clipId }
}
