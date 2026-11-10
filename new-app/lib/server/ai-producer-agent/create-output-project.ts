import 'server-only'

import type { Prisma } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { parseSettings } from '@/lib/server/clips/projects'

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
  const sourceSettings = p.settings && typeof p.settings === 'object' && !Array.isArray(p.settings)
    ? p.settings as Record<string, unknown> : {}
  const settings = { ...sourceSettings, ...parseSettings(sourceSettings, a.sourceProjectId), aiProducerRunId: a.runId }
  // Output projects are editable video timelines, not transcribe-only source jobs.
  delete settings.captionsOnly
  console.info('[youtube-video:settings]', {
    action: 'output_settings_validated', runId: a.runId,
    projectId, sourceProjectId: a.sourceProjectId, settingsVersion: settings.v,
  })
  await prisma.$transaction(async (tx) => {
    await tx.clipProject.create({
      data: {
        id: projectId,
        workspaceId: a.workspaceId,
        createdById: a.createdById,
        title: a.title,
        uploadId: p.uploadId,
        sourceUrl: p.sourceUrl,
        settings: settings as Prisma.InputJsonValue,
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
  console.info('[youtube-video:output]', {
    action: 'project_clip_created', runId: a.runId, projectId, clipId,
  })
  return { projectId, clipId }
}
