import type { ClipProjectListItem } from '@/lib/clips/project-list-item'
import { createReadableSignedUrl } from '@/lib/storage/resolve'
import { listClipProjects } from '@/lib/server/clips/projects'
import { getPrisma } from '@/lib/server/db'
import { Prisma } from '@prisma/client'

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

  const [counts, t2vRows, owners, publishes] = await Promise.all([
    prisma.clip.groupBy({
      by: ['projectId'],
      where: { projectId: { in: ids }, deletedAt: null },
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

  const countByProject = new Map(counts.map((c) => [c.projectId, c._count._all]))

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
      if (!thumbKey) {
        const negUntil = thumbFallbackMissUntil.get(p.id)
        if (negUntil == null || negUntil <= Date.now()) {
          const topClip = await prisma.clip.findFirst({
            where: { projectId: p.id, deletedAt: null, posterKey: { not: null } },
            orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
            select: { posterKey: true },
          })
          if (topClip?.posterKey) {
            thumbKey = topClip.posterKey
            thumbFallbackMissUntil.delete(p.id)
            await prisma.clipProject.update({ where: { id: p.id }, data: { thumbKey } }).catch(() => {})
          } else {
            if (thumbFallbackMissUntil.size >= 5000) thumbFallbackMissUntil.clear()
            thumbFallbackMissUntil.set(p.id, Date.now() + THUMB_FALLBACK_NEG_TTL_MS)
          }
        }
      }
      let thumbUrl: string | null = null
      if (thumbKey) {
        try {
          thumbUrl = await createReadableSignedUrl(thumbKey, THUMB_TTL)
        } catch {
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
        thumbKey: p.thumbKey,
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
