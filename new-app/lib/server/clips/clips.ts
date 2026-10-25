import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'

const SIGNED_TTL = 3600

export async function listProjectClips(workspaceId: string, projectId: string, sort: 'score' | 'timeline' = 'score') {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId, deletedAt: null } })
  if (!project) return null
  const clips = await prisma.clip.findMany({
    where: { projectId, deletedAt: null },
    orderBy: sort === 'timeline' ? { startMs: 'asc' } : { score: 'desc' },
  })
  const storage = getClipStorage()
  return Promise.all(
    clips.map(async (c) => ({
      id: c.id,
      projectId: c.projectId,
      title: c.title,
      reason: c.reason,
      startMs: c.startMs,
      endMs: c.endMs,
      score: c.score,
      scores: c.scores,
      favorite: c.favorite,
      durationMs: c.endMs - c.startMs,
      previewUrl: c.previewKey
        ? await storage.createSignedDownloadUrl(c.previewKey, SIGNED_TTL)
        : null,
      posterUrl: c.posterKey ? await storage.createSignedDownloadUrl(c.posterKey, SIGNED_TTL) : null,
    })),
  )
}

export async function getClipForWorkspace(workspaceId: string, clipId: string) {
  const prisma = getPrisma()
  return prisma.clip.findFirst({ where: { id: clipId, workspaceId, deletedAt: null } })
}

export function exportFilename(title: string, ext = 'mp4') {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return `${base || 'clip'}.${ext}`
}
