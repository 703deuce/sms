import type { ClipProjectListItem } from '@/lib/clips/project-list-item'
import { getClipStorage } from '@/lib/storage'
import { listClipProjects } from '@/lib/server/clips/projects'
import { getPrisma } from '@/lib/server/db'

export type { ClipProjectListItem } from '@/lib/clips/project-list-item'

const THUMB_TTL = 3600

export async function listClipProjectsForPage(
  workspaceId: string,
  opts: { q?: string; status?: string; limit?: number },
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

  const storage = getClipStorage()
  return Promise.all(
    projects.map(async (p) => {
      let thumbUrl: string | null = null
      if (p.thumbKey) {
        try {
          thumbUrl = await storage.createSignedDownloadUrl(p.thumbKey, THUMB_TTL)
        } catch {
          thumbUrl = null
        }
      }
      return {
        ...p,
        clipCount: countByProject.get(p.id) ?? 0,
        durationMs: Math.max(0, p.rangeEndMs - p.rangeStartMs),
        thumbUrl,
      }
    }),
  )
}
