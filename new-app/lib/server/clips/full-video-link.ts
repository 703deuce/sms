import 'server-only'

import { isFullVideoSettings } from '@/lib/clips/full-video'
import { createFullVideoProjectForUpload } from '@/lib/server/clips/ensure-full-video-project'
import { withPrismaPoolRetry, getPrisma } from '@/lib/server/db'

export type FullVideoLink = {
  projectId: string
  clipId: string
  url: string
  sourceMs: number
}

export type FullVideoLinkPreparing = {
  preparing: true
  stage: 'project' | 'clip'
  message: string
  projectId?: string
}

export type FullVideoLinkResult = FullVideoLink | FullVideoLinkPreparing | null

type FullVideoSourceRow = {
  sourceProjectId: string
  sourceProjectTitle: string
  sourceSettings: unknown
  sourceProxyKey: string | null
  sourceRangeEndMs: number
  transcriptWords: unknown
  sourceMs: number
  endMs: number
  clipTitle: string
  uploadId: string
  durationMs: number | null
  width: number | null
  height: number | null
  filename: string
  existingProjectId: string | null
  existingClipId: string | null
  dbStatementMs: number
}

/**
 * One parameterized query replaces the separate clip, upload, dedupe, transcript,
 * and existing-full-video-clip lookups. No cross-workspace lookup or writes.
 * The source transcript is only materialized when a full-video project is absent.
 */
export async function resolveFullVideoLink(
  workspaceId: string,
  clipId: string,
): Promise<FullVideoLinkResult> {
  const startedAt = Date.now()
  const prisma = getPrisma()
  console.log('[clipper:fullvideo-link] step=source_query_begin', { clipId })

  const rows = await withPrismaPoolRetry('FullVideoLink.source', () => prisma.$queryRaw<FullVideoSourceRow[]>`
    SELECT
      p.id AS "sourceProjectId",
      p.title AS "sourceProjectTitle",
      p.settings AS "sourceSettings",
      p."proxyKey" AS "sourceProxyKey",
      p."rangeEndMs" AS "sourceRangeEndMs",
      CASE WHEN fv.id IS NULL THEN p."transcriptWords" ELSE NULL END AS "transcriptWords",
      c."startMs" AS "sourceMs",
      c."endMs" AS "endMs",
      c.title AS "clipTitle",
      u.id AS "uploadId",
      u."durationMs" AS "durationMs",
      u.width AS "width",
      u.height AS "height",
      u.filename AS "filename",
      fv.id AS "existingProjectId",
      fv."clipId" AS "existingClipId",
      ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - statement_timestamp())) * 1000)::int AS "dbStatementMs"
    FROM clips c
    JOIN clip_projects p ON p.id = c."projectId"
      AND p."workspaceId" = ${workspaceId} AND p."deletedAt" IS NULL
    JOIN clip_uploads u ON u.id = p."uploadId"
      AND u."workspaceId" = ${workspaceId} AND u.status = 'COMPLETE'
    LEFT JOIN LATERAL (
      SELECT fp.id,
        (
          SELECT fc.id FROM clips fc
          WHERE fc."projectId" = fp.id
            AND fc."workspaceId" = ${workspaceId}
            AND fc."deletedAt" IS NULL
          ORDER BY fc."startMs" ASC
          LIMIT 1
        ) AS "clipId"
      FROM clip_projects fp
      WHERE fp."workspaceId" = ${workspaceId}
        AND fp."deletedAt" IS NULL
        AND (
          fp.id = p.settings->>'fromFullVideoProjectId'
          OR (
            fp."uploadId" = u.id
            AND fp.settings->>'fullVideo' = 'true'
          )
        )
      ORDER BY CASE
        WHEN fp.id = p.settings->>'fromFullVideoProjectId' THEN 0
        WHEN fp.id = 'proj_fv_' || u.id THEN 1
        ELSE 2
      END, fp."createdAt" DESC
      LIMIT 1
    ) fv ON TRUE
    WHERE c.id = ${clipId}
      AND c."workspaceId" = ${workspaceId}
      AND c."deletedAt" IS NULL
    LIMIT 1
  `)
  const source = rows[0]
  const readMs = Date.now() - startedAt
  console.log('[clipper:fullvideo-link] step=source_dedupe_transcript', {
    clipId,
    elapsedMs: readMs,
    dbStatementMs: source ? Number(source.dbStatementMs) : null,
    poolOrNetworkMsApprox: source ? Math.max(0, Math.round(readMs - Number(source.dbStatementMs))) : null,
    existingProject: Boolean(source?.existingProjectId),
    existingClip: Boolean(source?.existingClipId),
    transcriptReused: Array.isArray(source?.transcriptWords) && source.transcriptWords.length > 0,
  })
  if (!source) return null

  let projectId = source.existingProjectId
  let editorClipId = source.existingClipId
  if (!projectId && !isFullVideoSettings(source.sourceSettings)) {
    const createAt = Date.now()
    const ensured = await createFullVideoProjectForUpload(
      workspaceId,
      {
        id: source.uploadId,
        durationMs: source.durationMs,
        width: source.width,
        height: source.height,
        filename: source.filename,
      },
      {
        id: source.sourceProjectId,
        title: source.sourceProjectTitle,
        transcriptWords: source.transcriptWords,
        proxyKey: source.sourceProxyKey,
        rangeEndMs: source.sourceRangeEndMs,
      },
    )
    projectId = ensured.projectId
    editorClipId = ensured.clipId
    console.log('[clipper:fullvideo-link] step=project_ensure', {
      clipId,
      projectId,
      seededClip: Boolean(editorClipId),
      elapsedMs: Date.now() - createAt,
    })
  }
  if (!projectId) return null

  // An atomically seeded clip is already addressable when the project insert commits.
  // No extra read or worker wait is necessary to navigate to the real Timeline editor.
  if (!editorClipId) {
    console.log('[clipper:fullvideo-link] step=preparing_clip', {
      clipId, projectId, elapsedMs: Date.now() - startedAt,
    })
    return {
      preparing: true,
      stage: 'clip',
      message: 'Preparing full video editor (rendering clip)…',
      projectId,
    }
  }

  const title = encodeURIComponent(source.clipTitle.slice(0, 80))
  const url =
    `/app/video-editor/${projectId}/edit/${editorClipId}?t=${source.sourceMs}` +
    `&fromClip=${encodeURIComponent(clipId)}` +
    `&momentIn=${source.sourceMs}&momentOut=${source.endMs}&momentTitle=${title}`
  console.log('[clipper:fullvideo-link] step=ready', {
    clipId, projectId, editorClipId, elapsedMs: Date.now() - startedAt,
  })
  return { projectId, clipId: editorClipId, url, sourceMs: source.sourceMs }
}
