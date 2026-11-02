import { isClipUserHidden } from '@/lib/clips/clip-results-chips'
import { attachReasonTagsToClips, projectTranscriptToSourceWords } from '@/lib/server/clips/clip-reason-tags'
import { clipSpokenFirstLine } from '@/lib/clips/clip-spoken-line'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage, getClipStorageForObjectKey } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import { normalizeTranscriptJson } from '@/lib/server/clips/editor-words'

export type ListProjectClipsOpts = {
  includeHidden?: boolean
  /** Skip S3 transcript download on SSR list (client API can enrich later). */
  skipTranscriptEnrichment?: boolean
}

export async function listProjectClips(
  workspaceId: string,
  projectId: string,
  sort: 'score' | 'timeline' = 'score',
  opts?: ListProjectClipsOpts,
) {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    select: {
      settings: true,
      transcriptKey: true,
      upload: { select: { storageDriver: true } },
    },
  })
  if (!project) return null
  const clips = await prisma.clip.findMany({
    where: { projectId, deletedAt: null },
    orderBy: sort === 'timeline' ? { startMs: 'asc' } : { score: 'desc' },
  })
  const storage = getClipStorage()
  const visible = opts?.includeHidden
    ? clips
    : clips.filter((c) => !isClipUserHidden(c.aiMeta))

  let rows = await Promise.all(
    visible.map(async (c) => {
      const versionHint = c.updatedAt.toISOString()
      const signOpts = { versionHint }
      const [previewUrl, posterUrl] = await Promise.all([
        c.previewKey ? createCachedSignedDownloadUrl(storage, c.previewKey, signOpts) : Promise.resolve(null),
        c.posterKey ? createCachedSignedDownloadUrl(storage, c.posterKey, signOpts) : Promise.resolve(null),
      ])
      return {
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
        previewUrl,
        posterUrl,
        aiMeta: c.aiMeta,
        edits: c.edits,
      }
    }),
  )

  if (opts?.skipTranscriptEnrichment) {
    return rows
  }

  const needsTag = rows.some((c) => {
    const m = c.aiMeta as { reasonTag?: string } | null
    return m?.reasonTag !== 'speech' && m?.reasonTag !== 'visual' && m?.reasonTag !== 'both'
  })
  let projectWords: ReturnType<typeof projectTranscriptToSourceWords> | null = null
  const loadProjectWords = async () => {
    if (projectWords) return projectWords
    if (!project.transcriptKey) return null
    try {
      const driverHint = project.upload?.storageDriver ?? null
      const tStorage = await getClipStorageForObjectKey(project.transcriptKey, driverHint)
      const raw = await tStorage.getJson<unknown>(project.transcriptKey)
      projectWords = projectTranscriptToSourceWords(normalizeTranscriptJson(raw))
      return projectWords
    } catch {
      return null
    }
  }

  if (needsTag) {
    const words = await loadProjectWords()
    if (words?.length) rows = attachReasonTagsToClips(rows, words, project.settings)
  }

  const wordsForLines = projectWords ?? (await loadProjectWords())
  if (wordsForLines?.length) {
    rows = rows.map((c) => ({
      ...c,
      spokenFirstLine: clipSpokenFirstLine(wordsForLines, c.startMs, c.endMs) ?? undefined,
    }))
  }

  return rows
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
