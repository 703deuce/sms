import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma, withPrismaPoolRetry } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getClipStorageForObjectKey, getClipStorage } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import { resolveEditorAssets } from '@/lib/server/clips/editor-assets'

type PreparationRow = {
  status: string
  stage: string | null
  progress: number
  error: string | null
  proxyKey: string | null
  updatedAt: Date
  storageDriver: string | null
  aiMeta: unknown
  dbStatementMs: number
}

// One indexed project lookup with a lateral clip join; no second DB round trip.
// Polling remains read-only and scoped to a real full-video project in the workspace.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now()
  try {
    const { id } = await ctx.params
    const workspaceAt = Date.now()
    const workspaceId = await resolveWorkspaceId()
    console.log('[clipper:fullvideo-prepare] step=workspace', { projectId: id, elapsedMs: Date.now() - workspaceAt })
    const prisma = getPrisma()
    const queryAt = Date.now()
    const rows = await withPrismaPoolRetry('FullVideoPrepare.status', () => prisma.$queryRaw<PreparationRow[]>`
      SELECT
        p.status::text AS status,
        p.stage, p.progress, p.error,
        p."proxyKey" AS "proxyKey",
        p."updatedAt" AS "updatedAt",
        u."storageDriver" AS "storageDriver",
        fc."aiMeta" AS "aiMeta",
        ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - statement_timestamp())) * 1000)::int AS "dbStatementMs"
      FROM clip_projects p
      LEFT JOIN clip_uploads u ON u.id = p."uploadId"
        AND u."workspaceId" = ${workspaceId}
      LEFT JOIN LATERAL (
        SELECT c."aiMeta"
        FROM clips c
        WHERE c."projectId" = p.id
          AND c."workspaceId" = ${workspaceId}
          AND c."deletedAt" IS NULL
        ORDER BY c."startMs" ASC
        LIMIT 1
      ) fc ON TRUE
      WHERE p.id = ${id}
        AND p."workspaceId" = ${workspaceId}
        AND p."deletedAt" IS NULL
        AND p.settings->>'fullVideo' = 'true'
      LIMIT 1
    `)
    const project = rows[0]
    const queryMs = Date.now() - queryAt
    console.log('[clipper:fullvideo-prepare] step=project_and_clip', {
      projectId: id,
      queryMs,
      dbStatementMs: project ? Number(project.dbStatementMs) : null,
      poolOrNetworkMsApprox: project ? Math.max(0, Math.round(queryMs - Number(project.dbStatementMs))) : null,
    })
    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const driver = project.storageDriver
    const signedAt = Date.now()
    const [proxy, editorAssets] = await Promise.all([
      project.proxyKey
        ? getClipStorageForObjectKey(project.proxyKey, driver).then((storage) =>
            createCachedSignedDownloadUrl(storage, project.proxyKey!, {
              versionHint: project.updatedAt.toISOString(),
            }),
          ).catch(() => null)
        : Promise.resolve(null),
      project.aiMeta
        ? resolveEditorAssets(getClipStorage(driver), project.aiMeta, project.updatedAt.toISOString()).catch(() => null)
        : Promise.resolve(null),
    ])
    console.log('[clipper:fullvideo-prepare] step=sign_assets', {
      projectId: id, elapsedMs: Date.now() - signedAt, hasProxy: Boolean(proxy),
    })
    console.log('[clipper:fullvideo-prepare] step=status', {
      projectId: id, stage: project.stage, progress: project.progress,
      hasProxy: Boolean(proxy), elapsedMs: Date.now() - startedAt,
    })
    return NextResponse.json({ data: {
      status: project.status,
      stage: project.stage,
      progress: project.progress,
      error: project.error,
      proxy,
      editorAssets,
    } }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.warn('[clipper:fullvideo-prepare] step=failed', {
      elapsedMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    })
    return jsonError(error)
  }
}
