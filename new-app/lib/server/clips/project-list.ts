import type { ClipProjectListItem } from '@/lib/clips/project-list-item'
import { getClipStorage } from '@/lib/storage'
import { listClipProjects } from '@/lib/server/clips/projects'
import { getPrisma } from '@/lib/server/db'

export type { ClipProjectListItem } from '@/lib/clips/project-list-item'

const THUMB_TTL = 3600

export async function listClipProjectsForPage(
  workspaceId: string,
  opts: { q?: string; status?: string; limit?: number; trash?: boolean; folderId?: string | null },
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
      return {
        ...p,
        clipCount: countByProject.get(p.id) ?? 0,
        durationMs: Math.max(0, p.rangeEndMs - p.rangeStartMs),
        thumbUrl,
        ownerName: ownerNameById.get(p.createdById) ?? null,
        isPublished: publishedProjectIds.has(p.id),
        publishedAt: publishedAtByProject.get(p.id)?.toISOString() ?? null,
      }
    }),
  )
}
