import { isClipUserHidden } from '@/lib/clips/clip-results-chips'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'

export async function listProjectClips(
  workspaceId: string,
  projectId: string,
  sort: 'score' | 'timeline' = 'score',
  opts?: { includeHidden?: boolean },
) {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId, deletedAt: null } })
  if (!project) return null
  const clips = await prisma.clip.findMany({
    where: { projectId, deletedAt: null },
    orderBy: sort === 'timeline' ? { startMs: 'asc' } : { score: 'desc' },
  })
  const storage = getClipStorage()
  const visible = opts?.includeHidden
    ? clips
    : clips.filter((c) => !isClipUserHidden(c.aiMeta))

  return Promise.all(
    visible.map(async (c) => ({
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
      previewUrl: c.previewKey ? await createCachedSignedDownloadUrl(storage, c.previewKey) : null,
      posterUrl: c.posterKey ? await createCachedSignedDownloadUrl(storage, c.posterKey) : null,
      aiMeta: c.aiMeta,
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
