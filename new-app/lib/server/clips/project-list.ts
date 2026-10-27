import type { ClipProjectListItem } from '@/lib/clips/project-list-item'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { getClipStorage } from '@/lib/storage'
import { listClipProjects } from '@/lib/server/clips/projects'
import { getPrisma } from '@/lib/server/db'

export type { ClipProjectListItem } from '@/lib/clips/project-list-item'

const THUMB_TTL = 3600

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
  const counts = await prisma.clip.groupBy({
    by: ['projectId'],
    where: { projectId: { in: ids }, deletedAt: null },
    _count: { _all: true },
  })
  const countByProject = new Map(counts.map((c) => [c.projectId, c._count._all]))

  const t2vByProject = new Map<
    string,
    { status: string; progress: number; sceneThumb: string | null; sceneCount: number }
  >()
  const t2vProjectIds = projects.filter((p) => p.sourceKind === 't2v').map((p) => p.id)
  if (t2vProjectIds.length) {
    const drafts = await prisma.t2vDraft.findMany({
      where: { projectId: { in: t2vProjectIds } },
      select: { projectId: true, status: true, progress: true, document: true },
    })
    for (const d of drafts) {
      const doc = d.document as T2vDraftV1
      const first = doc.scenes?.[0]
      const sceneThumb = first?.media?.thumbUrl ?? first?.media?.previewUrl ?? null
      t2vByProject.set(d.projectId, {
        status: d.status,
        progress: d.progress,
        sceneThumb,
        sceneCount: doc.scenes?.length ?? 0,
      })
    }
  }

  const ownerIds = [...new Set(projects.map((p) => p.createdById).filter(Boolean))]
  const owners = ownerIds.length
    ? await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true } })
    : []
  const ownerNameById = new Map(owners.map((u) => [u.id, u.name]))

  const publishes = await prisma.scriptCompositionPublish.findMany({
    where: { workspaceId, composition: { projectId: { in: ids } } },
    select: { publishedAt: true, composition: { select: { projectId: true } } },
  })
  const publishedProjectIds = new Set(publishes.map((pub) => pub.composition.projectId))
  const publishedAtByProject = new Map<string, Date>()
  for (const pub of publishes) {
    const pid = pub.composition.projectId
    const prev = publishedAtByProject.get(pid)
    if (!prev || pub.publishedAt > prev) publishedAtByProject.set(pid, pub.publishedAt)
  }

  const storage = getClipStorage()
  return Promise.all(
    projects.map(async (p) => {
      let thumbKey = p.thumbKey
      if (!thumbKey) {
        const topClip = await prisma.clip.findFirst({
          where: { projectId: p.id, deletedAt: null, posterKey: { not: null } },
          orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
          select: { posterKey: true },
        })
        if (topClip?.posterKey) {
          thumbKey = topClip.posterKey
          await prisma.clipProject.update({ where: { id: p.id }, data: { thumbKey } }).catch(() => {})
        }
      }
      let thumbUrl: string | null = null
      if (thumbKey) {
        try {
          thumbUrl = await storage.createSignedDownloadUrl(thumbKey, THUMB_TTL)
        } catch {
          thumbUrl = null
        }
      }
      const t2v = t2vByProject.get(p.id)
      return {
        ...p,
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
