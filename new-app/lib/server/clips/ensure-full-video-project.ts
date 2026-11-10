import 'server-only'

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
import { defaultEdits } from '@/lib/clips/edits'

/** Find an existing full-video project for this upload (newest first). */
export async function findFullVideoProjectForUpload(workspaceId: string, uploadId: string) {
  const prisma = getPrisma()
  const direct = await prisma.clipProject.findFirst({
    where: { id: `proj_fv_${uploadId}`, workspaceId, uploadId, deletedAt: null },
    select: { id: true, settings: true },
  })
  if (direct && isFullVideoSettings(direct.settings)) return direct
  // Preserve legacy full-video dedupe without reading every sibling project.
  return prisma.clipProject.findFirst({
    where: { workspaceId, uploadId, deletedAt: null, settings: { path: ['fullVideo'], equals: true } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, settings: true },
  })
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
  const durationMs = upload.durationMs && upload.durationMs > 0 ? upload.durationMs : null
  // Seed a real full-length clip atomically with the project: the source is editable
  // immediately, while peaks/filmstrip/proxy are prepared by the existing worker.
  const fastClipId = durationMs ? `clip_fv_${upload.id}` : null
  const fastEdits = durationMs ? {
    ...defaultEdits({ clipStartMs: 0, clipEndMs: durationMs }),
    aspectRatio: aspect,
    layout: { mode: 'full_frame' as const, shotOverrides: [] },
    exportTemplate: { headlineBar: { enabled: false }, platformBadge: { enabled: false } },
  } : null

  console.log('[clipper:fullvideo-link] ensure_begin', {
    uploadId: upload.id,
    sourceProjectId: sourceProject.id,
    hasTranscriptWords: Boolean(transcriptWords),
    hasProxy: Boolean(sourceProject.proxyKey),
    fastClip: Boolean(fastClipId),
  })

  // Deterministic per-upload id makes concurrent creates collide safely on the
  // primary key. The nested job write is atomic with the project create.
  const newId = `proj_fv_${upload.id}`
  try {
    await prisma.clipProject.create({
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
        // Copied DB words are authoritative: avoid a missing S3-key fetch on first load.
        transcriptKey: transcriptWords ? null : projectWordsKey(workspaceId, newId),
        ...(transcriptWords ? { transcriptWords: JSON.parse(JSON.stringify(transcriptWords)) } : {}),
        ...(sourceProject.proxyKey ? { proxyKey: sourceProject.proxyKey } : {}),
        ...(fastClipId && fastEdits && durationMs ? {
          clips: {
            create: {
              id: fastClipId,
              workspaceId,
              title,
              reason: 'user_upload',
              startMs: 0,
              endMs: durationMs,
              score: 0,
              scores: {},
              edits: JSON.parse(JSON.stringify(fastEdits)),
              aiMeta: { byo: true, fullVideo: true },
            },
          },
        } : {}),
        jobs: {
          create: {
            id: createId('job'),
            type: 'PROCESS_PROJECT',
            status: 'QUEUED',
            payload: toPrismaJson(buildProcessProjectJobPayload(settings, fastClipId ? { preseededFullVideo: true } : undefined)),
          },
        },
      },
    })
    console.log('[clipper:fullvideo-link] ensure_created', {
      uploadId: upload.id,
      projectId: newId,
      clipId: fastClipId,
      transcriptReused: Boolean(transcriptWords),
    })
    return newId
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code
    if (code === 'P2002') {
      const concurrent = await findFullVideoProjectForUpload(workspaceId, upload.id)
      if (concurrent) {
        console.info('[clipper:fullvideo-link] ensure_reuse', {
          uploadId: upload.id,
          projectId: concurrent.id,
          reason: 'concurrent_create',
        })
        return concurrent.id
      }
    }
    throw error
  }
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
