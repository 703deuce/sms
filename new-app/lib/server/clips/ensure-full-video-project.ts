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
/**
 * Single PostgreSQL statement: project, immediately usable clip and background
 * PROCESS_PROJECT job are committed atomically. The caller has already looked up
 * existing projects, so another dedupe round trip would double first-open latency.
 * A conflict is the only time we fall back to a read.
 */
export async function createFullVideoProjectForUpload(
  workspaceId: string,
  upload: { id: string; durationMs: number | null; width: number | null; height: number | null; filename: string },
  sourceProject: SourceProject,
): Promise<{ projectId: string; clipId: string | null }> {
  const startedAt = Date.now()
  assertFullVideoUploadDuration(upload.durationMs)
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
      : null
  const title = `${sourceProject.title || upload.filename.replace(/\.[^.]+$/, '')} · full`.slice(0, 200)
  const durationMs = upload.durationMs && upload.durationMs > 0 ? upload.durationMs : null
  const projectId = `proj_fv_${upload.id}`
  const fastClipId = durationMs ? `clip_fv_${upload.id}` : null
  const edits = durationMs
    ? {
        ...defaultEdits({ clipStartMs: 0, clipEndMs: durationMs }),
        aspectRatio: aspect,
        layout: { mode: 'full_frame' as const, shotOverrides: [] },
        exportTemplate: { headlineBar: { enabled: false }, platformBadge: { enabled: false } },
      }
    : null
  const jobPayload = buildProcessProjectJobPayload(
    settings,
    fastClipId ? { preseededFullVideo: true } : undefined,
  )
  const prisma = getPrisma()

  console.log('[clipper:fullvideo-link] step=ensure_begin', {
    uploadId: upload.id,
    sourceProjectId: sourceProject.id,
    hasTranscriptWords: Boolean(transcriptWords),
    hasProxy: Boolean(sourceProject.proxyKey),
    hasSeedClip: Boolean(fastClipId),
  })
  const queryAt = Date.now()
  const created = await prisma.$queryRaw<{
    projectId: string
    clipId: string | null
    dbStatementMs: number
  }[]>`
    WITH created_project AS (
      INSERT INTO clip_projects (
        id, "workspaceId", title, "uploadId", settings,
        "rangeStartMs", "rangeEndMs", status, stage, progress,
        "transcriptKey", "transcriptWords", "proxyKey", "updatedAt"
      )
      VALUES (
        ${projectId}, ${workspaceId}, ${title}, ${upload.id},
        ${JSON.stringify(settings)}::jsonb,
        0, ${settings.rangeEndMs}, 'QUEUED', 'queued', 0,
        ${transcriptWords ? null : projectWordsKey(workspaceId, projectId)},
        ${transcriptWords ? JSON.stringify(transcriptWords) : null}::jsonb,
        ${sourceProject.proxyKey}, NOW()
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    ),
    seeded_clip AS (
      INSERT INTO clips (
        id, "projectId", "workspaceId", title, reason,
        "startMs", "endMs", edits, "aiMeta", "updatedAt"
      )
      SELECT
        ${fastClipId}, p.id, ${workspaceId}, ${title}, 'user_upload',
        0, ${durationMs}, ${JSON.stringify(edits || {})}::jsonb,
        '{"byo":true,"fullVideo":true}'::jsonb, NOW()
      FROM created_project p
      WHERE ${fastClipId}::text IS NOT NULL
      RETURNING id
    ),
    queued_job AS (
      INSERT INTO clip_jobs (id, "projectId", type, status, payload)
      SELECT ${createId('job')}, p.id, 'PROCESS_PROJECT', 'QUEUED',
        ${JSON.stringify(jobPayload)}::jsonb
      FROM created_project p
      LEFT JOIN seeded_clip sc ON TRUE
      RETURNING id
    )
    SELECT
      p.id AS "projectId", sc.id AS "clipId",
      ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - statement_timestamp())) * 1000)::int AS "dbStatementMs"
    FROM created_project p
    LEFT JOIN seeded_clip sc ON TRUE
    JOIN queued_job job ON TRUE
  `
  const queryMs = Date.now() - queryAt
  const result = created[0]
  console.log('[clipper:fullvideo-link] step=ensure_insert', {
    uploadId: upload.id,
    projectId,
    inserted: Boolean(result),
    queryMs,
    dbStatementMs: result ? Number(result.dbStatementMs) : null,
    poolOrNetworkMsApprox: result ? Math.max(0, Math.round(queryMs - Number(result.dbStatementMs))) : null,
  })
  if (result) {
    console.log('[clipper:fullvideo-link] step=ensure_created', {
      uploadId: upload.id,
      projectId: result.projectId,
      clipId: result.clipId,
      elapsedMs: Date.now() - startedAt,
    })
    return { projectId: result.projectId, clipId: result.clipId }
  }

  // Two clients may click concurrently. ON CONFLICT prevents duplicate projects,
  // clips or jobs. Resolve the winner's actual clip rather than guessing its ID.
  const concurrent = await prisma.clipProject.findFirst({
    where: { id: projectId, workspaceId, uploadId: upload.id, deletedAt: null },
    select: {
      id: true, settings: true,
      clips: {
        where: { workspaceId, deletedAt: null },
        orderBy: { startMs: 'asc' },
        take: 1,
        select: { id: true },
      },
    },
  })
  if (concurrent && isFullVideoSettings(concurrent.settings)) {
    console.log('[clipper:fullvideo-link] step=ensure_reuse', {
      uploadId: upload.id,
      projectId: concurrent.id,
      reason: 'concurrent_create',
      elapsedMs: Date.now() - startedAt,
    })
    return { projectId: concurrent.id, clipId: concurrent.clips[0]?.id ?? null }
  }
  // Existing deleted projects deliberately cannot be revived by a stale clip link.
  throw new Error('Full-video project creation conflicted with a different project')
}

/** Retained contract for other full-video creation callers. */
export async function ensureFullVideoProjectForUpload(
  workspaceId: string,
  upload: { id: string; durationMs: number | null; width: number | null; height: number | null; filename: string },
  sourceProject: SourceProject,
): Promise<string> {
  const existing = await findFullVideoProjectForUpload(workspaceId, upload.id)
  if (existing) {
    console.log('[clipper:fullvideo-link] step=ensure_existing', { uploadId: upload.id, projectId: existing.id })
    return existing.id
  }
  return (await createFullVideoProjectForUpload(workspaceId, upload, sourceProject)).projectId
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
