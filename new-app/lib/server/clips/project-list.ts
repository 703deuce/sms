import type { ClipProjectListItem } from '@/lib/clips/project-list-item'
import { createReadableSignedUrl } from '@/lib/storage/resolve'
import { listClipProjects } from '@/lib/server/clips/projects'
import { getPrisma } from '@/lib/server/db'
import { Prisma } from '@prisma/client'
import { isClipUserHidden } from '@/lib/clips/clip-results-chips'
import { enqueueClipCardThumbnail } from '@/lib/server/clips/card-thumbnails'

export type { ClipProjectListItem } from '@/lib/clips/project-list-item'

const THUMB_TTL = 3600
const THUMB_FALLBACK_NEG_TTL_MS = 7 * 60 * 1000

/** projectId → untilMs when a poster lookup recently returned nothing (skip repeat findFirst). */
const thumbFallbackMissUntil = new Map<string, number>()

type T2vListMetaRow = {
  projectId: string
  status: string
  progress: number
  sceneThumb: string | null
  sceneCount: number
}

async function loadT2vListMeta(projectIds: string[]): Promise<T2vListMetaRow[]> {
  if (!projectIds.length) return []
  const prisma = getPrisma()
  return prisma.$queryRaw<T2vListMetaRow[]>`
    SELECT
      d."projectId" AS "projectId",
      d.status AS status,
      d.progress AS progress,
      COALESCE(
        d.document->'scenes'->0->'media'->>'thumbUrl',
        d.document->'scenes'->0->'media'->>'previewUrl'
      ) AS "sceneThumb",
      COALESCE(jsonb_array_length(d.document->'scenes'), 0)::int AS "sceneCount"
    FROM t2v_drafts d
    WHERE d."projectId" IN (${Prisma.join(projectIds)})
  `
}

/** Test hook. */
export function __resetThumbFallbackNegCache(): void {
  thumbFallbackMissUntil.clear()
}

export async function listClipProjectsForPage(
  workspaceId: string,
  opts: {
    q?: string
    status?: string
    kind?: string
    limit?: number
    trash?: boolean
    folderId?: string | null
  },
): Promise<ClipProjectListItem[]> {
  const projects = await listClipProjects(workspaceId, opts)
  if (projects.length === 0) return []

  const prisma = getPrisma()
  const ids = projects.map((p) => p.id)
  const ownerIds = [...new Set(projects.map((p) => p.createdById).filter(Boolean))]
  const t2vProjectIds = projects.filter((p) => p.sourceKind === 't2v').map((p) => p.id)

  console.info('[clips:projects] list_meta begin', { projectCount: ids.length })
  const [counts, hiddenCounts, t2vRows, owners, publishes] = await Promise.all([
    prisma.clip.groupBy({
      by: ['projectId'],
      where: { projectId: { in: ids }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.clip.groupBy({
      by: ['projectId'],
      where: {
        projectId: { in: ids },
        deletedAt: null,
        aiMeta: { path: ['userHidden'], equals: true },
      },
      _count: { _all: true },
    }),
    loadT2vListMeta(t2vProjectIds),
    ownerIds.length
      ? prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    prisma.scriptCompositionPublish.findMany({
      where: { workspaceId, composition: { projectId: { in: ids } } },
      select: { publishedAt: true, composition: { select: { projectId: true } } },
    }),
  ])

  const hiddenCountByProject = new Map(hiddenCounts.map((row) => [row.projectId, row._count._all]))
  const countByProject = new Map(
    counts.map((row) => [
      row.projectId,
      Math.max(0, row._count._all - (hiddenCountByProject.get(row.projectId) ?? 0)),
    ]),
  )
  console.info('[clips:projects] list_meta end', {
    projectCount: ids.length,
    hiddenClipCount: hiddenCounts.reduce((sum, row) => sum + row._count._all, 0),
  })

  const t2vByProject = new Map<
    string,
    { status: string; progress: number; sceneThumb: string | null; sceneCount: number }
  >()
  for (const d of t2vRows) {
    t2vByProject.set(d.projectId, {
      status: d.status,
      progress: d.progress,
      sceneThumb: d.sceneThumb,
      sceneCount: d.sceneCount,
    })
  }

  const ownerNameById = new Map(owners.map((u) => [u.id, u.name]))

  const publishedProjectIds = new Set(publishes.map((pub) => pub.composition.projectId))
  const publishedAtByProject = new Map<string, Date>()
  for (const pub of publishes) {
    const pid = pub.composition.projectId
    const prev = publishedAtByProject.get(pid)
    if (!prev || pub.publishedAt > prev) publishedAtByProject.set(pid, pub.publishedAt)
  }

  return Promise.all(
    projects.map(async (p): Promise<ClipProjectListItem> => {
      let thumbKey = p.thumbKey
      let sourceFrameUrl: string | null = null
      let sourceFrameStartMs = 0
      if (!thumbKey && p.sourceKind !== 't2v') {
        const started = Date.now()
        console.info('[clips:projects] preview_backfill begin', { projectId: p.id })
        const candidates = await prisma.clip.findMany({
          where: { projectId: p.id, deletedAt: null },
          orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
          take: 12,
          select: {
            id: true,
            aiMeta: true,
            posterKey: true,
            startMs: true,
            sourceSegKey: true,
            sourceSegStartMs: true,
          },
        })
        const topClip = candidates.find((clip) => !isClipUserHidden(clip.aiMeta)) ?? null
        if (topClip?.posterKey) {
          thumbKey = topClip.posterKey
          thumbFallbackMissUntil.delete(p.id)
          await prisma.clipProject.update({ where: { id: p.id }, data: { thumbKey } }).catch(() => {})
          console.info('[clips:projects] preview_backfill poster_found', {
            projectId: p.id, clipId: topClip.id, elapsedMs: Date.now() - started,
          })
        } else if (topClip) {
          const negUntil = thumbFallbackMissUntil.get(p.id)
          if (negUntil == null || negUntil <= Date.now()) {
            try {
              const queued = await enqueueClipCardThumbnail(p.workspaceId, topClip.id, 'page_load_backfill')
              console.info('[clips:projects] preview_backfill thumbnail_queued', {
                projectId: p.id, clipId: topClip.id, queued,
              })
            } catch (error) {
              console.warn('[clips:projects] preview_backfill thumbnail_failed', {
                projectId: p.id, clipId: topClip.id, error: String(error),
              })
            }
            if (thumbFallbackMissUntil.size >= 5000) thumbFallbackMissUntil.clear()
            thumbFallbackMissUntil.set(p.id, Date.now() + THUMB_FALLBACK_NEG_TTL_MS)
          }

          let sourceKey = topClip.sourceSegKey
          let sourceOffsetMs = Number(topClip.sourceSegStartMs ?? topClip.startMs)
          if (!sourceKey) {
            const source = await prisma.clipProject.findUnique({
              where: { id: p.id },
              select: {
                proxyKey: true,
                upload: { select: { key: true } },
              },
            })
            sourceKey = source?.proxyKey || source?.upload?.key || null
            sourceOffsetMs = source?.proxyKey ? p.rangeStartMs : 0
          }
          if (sourceKey) {
            try {
              sourceFrameUrl = await createReadableSignedUrl(sourceKey, THUMB_TTL)
              sourceFrameStartMs = Math.max(0, topClip.startMs - sourceOffsetMs)
              console.info('[clips:projects] preview_backfill source_frame_ready', {
                projectId: p.id,
                clipId: topClip.id,
                sourceFrameStartMs,
              })
            } catch (error) {
              console.warn('[clips:projects] preview_backfill source_frame_failed', {
                projectId: p.id, clipId: topClip.id, error: String(error),
              })
            }
          }
        }
        console.info('[clips:projects] preview_backfill end', {
          projectId: p.id,
          clipId: topClip?.id ?? null,
          hasPoster: Boolean(thumbKey),
          hasSourceFrame: Boolean(sourceFrameUrl),
          elapsedMs: Date.now() - started,
        })
      }
      let thumbUrl: string | null = null
      if (thumbKey) {
        try {
          thumbUrl = await createReadableSignedUrl(thumbKey, THUMB_TTL)
        } catch (error) {
          console.warn('[clips:projects] preview_sign_failed', { projectId: p.id, error: String(error) })
          thumbUrl = null
        }
      }
      const t2v = t2vByProject.get(p.id)
      return {
        id: p.id,
        workspaceId: p.workspaceId,
        title: p.title,
        uploadId: p.uploadId,
        sourceUrl: p.sourceUrl,
        rangeStartMs: p.rangeStartMs,
        rangeEndMs: p.rangeEndMs,
        status: p.status,
        stage: p.stage,
        progress: p.progress,
        error: p.error,
        transcriptKey: p.transcriptKey,
        thumbKey,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        createdById: p.createdById,
        folderId: p.folderId,
        deletedAt: p.deletedAt,
        sourceKind: p.sourceKind,
        lastViewedAt: p.lastViewedAt,
        clipCount: countByProject.get(p.id) ?? 0,
        durationMs: Math.max(0, p.rangeEndMs - p.rangeStartMs),
        thumbUrl: thumbUrl ?? t2v?.sceneThumb ?? null,
        sourceFrameUrl,
        sourceFrameStartMs,
        ownerName: ownerNameById.get(p.createdById) ?? null,
        isPublished: publishedProjectIds.has(p.id),
        publishedAt: publishedAtByProject.get(p.id)?.toISOString() ?? null,
        t2vDraftStatus: t2v?.status ?? null,
        t2vDraftProgress: t2v?.progress ?? null,
        t2vSceneCount: t2v?.sceneCount ?? null,
      }
    }),
  )
}
