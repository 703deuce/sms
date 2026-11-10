import 'server-only'

import { Prisma } from '@prisma/client'
import { createId } from '@/lib/supabase/id'
import { withAutoContentDetection } from '@/lib/clips/content-detection'
import {
  assertFullVideoUploadDuration,
  isFullVideoSettings,
  sourceAspectRatio,
} from '@/lib/clips/full-video'
import { clipProjectSettingsSchema, defaultClipSettings } from '@/lib/clips/settings'
import { buildProcessProjectJobPayload } from '@/lib/server/clips/process-project-payload'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { getPrisma } from '@/lib/server/db'
import { projectWordsKey } from '@/lib/storage'

/** Find an existing full-video project for this upload (newest first). */
export async function findFullVideoProjectForUpload(workspaceId: string, uploadId: string) {
  const prisma = getPrisma()
  const rows = await prisma.clipProject.findMany({
    where: { workspaceId, uploadId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, settings: true },
  })
  return rows.find((p) => isFullVideoSettings(p.settings)) ?? null
}

type SourceProject = {
  id: string
  title: string
  transcriptWords: unknown
  proxyKey: string | null
  rangeEndMs: number
}

/**
 * CL-05: create a full-video BYO project for an upload (no clip finding, no ASR when transcript is copied).
 * Reuses transcript + proxy from the clip-finding project when present.
 */
export async function ensureFullVideoProjectForUpload(
  workspaceId: string,
  upload: { id: string; durationMs: number | null; width: number | null; height: number | null; filename: string },
  sourceProject: SourceProject,
): Promise<string> {
  const existing = await findFullVideoProjectForUpload(workspaceId, upload.id)
  if (existing) return existing.id

  assertFullVideoUploadDuration(upload.durationMs)
  const prisma = getPrisma()
  const aspect = sourceAspectRatio(upload.width, upload.height)
  const settings = withAutoContentDetection(
    clipProjectSettingsSchema.parse({
      ...defaultClipSettings(),
      byo: true,
      fullVideo: true,
      rangeStartMs: 0,
      rangeEndMs: upload.durationMs || sourceProject.rangeEndMs || 0,
      aspectRatio: aspect,
    }),
  )
  const transcriptWords =
    Array.isArray(sourceProject.transcriptWords) && sourceProject.transcriptWords.length
      ? sourceProject.transcriptWords
      : undefined
  const title = `${sourceProject.title || upload.filename.replace(/\.[^.]+$/, '')} · full`.slice(0, 200)

  console.info('[clipper:fullvideo-link] ensure_begin', {
    uploadId: upload.id,
    sourceProjectId: sourceProject.id,
    hasTranscriptWords: Boolean(transcriptWords),
    hasProxy: Boolean(sourceProject.proxyKey),
  })

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const newId = createId('proj')
    try {
      return await prisma.$transaction(
        async (tx) => {
          const candidates = await tx.clipProject.findMany({
            where: { workspaceId, uploadId: upload.id, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            select: { id: true, settings: true },
          })
          const concurrent = candidates.find((project) => isFullVideoSettings(project.settings))
          if (concurrent) {
            console.info('[clipper:fullvideo-link] ensure_reuse', {
              uploadId: upload.id,
              projectId: concurrent.id,
              attempt,
            })
            return concurrent.id
          }

          await tx.clipProject.create({
            data: {
              id: newId,
              workspaceId,
              title,
              uploadId: upload.id,
              settings: JSON.parse(JSON.stringify(settings)),
              rangeStartMs: 0,
              rangeEndMs: settings.rangeEndMs,
              status: 'QUEUED',
              stage: 'queued',
              progress: 0,
              transcriptKey: projectWordsKey(workspaceId, newId),
              ...(transcriptWords ? { transcriptWords: JSON.parse(JSON.stringify(transcriptWords)) } : {}),
              ...(sourceProject.proxyKey ? { proxyKey: sourceProject.proxyKey } : {}),
            },
          })
          await tx.clipJob.create({
            data: {
              id: createId('job'),
              projectId: newId,
              type: 'PROCESS_PROJECT',
              status: 'QUEUED',
              payload: toPrismaJson(buildProcessProjectJobPayload(settings)),
            },
          })
          console.info('[clipper:fullvideo-link] ensure_created', {
            uploadId: upload.id,
            projectId: newId,
            attempt,
          })
          return newId
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code
      if (code === 'P2034' && attempt < 2) {
        console.warn('[clipper:fullvideo-link] ensure_retry', {
          uploadId: upload.id,
          attempt,
          errorCode: code,
        })
        continue
      }
      throw error
    }
  }

  throw new Error('Could not create full-video project')
}

export async function waitForFullVideoClip(
  workspaceId: string,
  fvProjectId: string,
  timeoutMs = 20_000,
): Promise<{ id: string } | null> {
  const prisma = getPrisma()
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const clip = await prisma.clip.findFirst({
      where: { projectId: fvProjectId, workspaceId, deletedAt: null },
      orderBy: { startMs: 'asc' },
      select: { id: true },
    })
    if (clip) return clip
    await new Promise((r) => setTimeout(r, 400))
  }
  return null
}
