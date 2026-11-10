import type { Prisma } from '@prisma/client'
import { isClipUserHidden } from '@/lib/clips/clip-results-chips'
import { attachReasonTagsToClips, projectTranscriptToSourceWords } from '@/lib/server/clips/clip-reason-tags'
import { clipSpokenFirstLine } from '@/lib/clips/clip-spoken-line'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage, getClipStorageForObjectKey } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import { normalizeTranscriptJson } from '@/lib/server/clips/editor-words'

export type ListProjectClipsProjectContext = {
  settings: unknown
  transcriptKey: string | null
  proxyKey?: string | null
  rangeStartMs?: number
  upload: { storageDriver: string | null; key?: string | null } | null
}

export type ClipListRow = Prisma.ClipGetPayload<{ select: typeof listClipSelect }>

export type ListProjectClipsOpts = {
  includeHidden?: boolean
  /** Skip S3 transcript download on SSR list (client API can enrich later). */
  skipTranscriptEnrichment?: boolean
  /** When the caller already loaded project fields, skip the extra findFirst. */
  project?: ListProjectClipsProjectContext
  /** Internal batch-load fast path: rows already fetched for this project. */
  prefetchedClips?: ClipListRow[]
}

const listClipSelect = {
  id: true,
  projectId: true,
  title: true,
  reason: true,
  startMs: true,
  endMs: true,
  score: true,
  scores: true,
  favorite: true,
  aiMeta: true,
  edits: true,
  previewKey: true,
  posterKey: true,
  sourceSegKey: true,
  sourceSegStartMs: true,
  updatedAt: true,
} as const

export async function listProjectClips(
  workspaceId: string,
  projectId: string,
  sort: 'score' | 'timeline' = 'score',
  opts?: ListProjectClipsOpts,
) {
  const prisma = getPrisma()
  let project = opts?.project ?? null
  if (!project) {
    project = await prisma.clipProject.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      select: {
        settings: true,
        transcriptKey: true,
        proxyKey: true,
        rangeStartMs: true,
        upload: { select: { storageDriver: true, key: true } },
      },
    })
  }
  if (!project) return null
  const clips = opts?.prefetchedClips ?? await (async () => {
    const started = Date.now()
    const found = await prisma.clip.findMany({
      where: { projectId, deletedAt: null },
      orderBy: sort === 'timeline' ? { startMs: 'asc' } : { score: 'desc' },
      select: listClipSelect,
    })
    console.info('[page:timing]', {
      path: '/app/clips/[projectId]', query: 'clip_rows', projectId,
      elapsedMs: Date.now() - started, rows: found.length,
    })
    return found
  })()
  const storage = getClipStorage()
  const visible = opts?.includeHidden
    ? clips
    : clips.filter((c) => !isClipUserHidden(c.aiMeta))

  const needsProjectFallback = visible.some((c) => !c.previewKey && !c.posterKey && !c.sourceSegKey)
  const projectFallbackKey = project.proxyKey || project.upload?.key || null
  let projectFallback: { url: string; offsetMs: number } | null = null
  if (needsProjectFallback && projectFallbackKey) {
    try {
      const sourceStorage = await getClipStorageForObjectKey(projectFallbackKey, project.upload?.storageDriver ?? null)
      projectFallback = {
        url: await createCachedSignedDownloadUrl(sourceStorage, projectFallbackKey, {
          versionHint: `clip-card-source:${projectId}`,
        }),
        offsetMs: project.proxyKey ? Number(project.rangeStartMs ?? 0) : 0,
      }
    } catch (error) {
      console.warn('[clips:cards] thumbnail source_fallback_sign_failed', { projectId, error: String(error) })
    }
  }

  let rows = await Promise.all(
    visible.map(async (c) => {
      const versionHint = c.updatedAt.toISOString()
      const signOpts = { versionHint }
      const [previewUrl, posterUrl] = await Promise.all([
        c.previewKey ? createCachedSignedDownloadUrl(storage, c.previewKey, signOpts) : Promise.resolve(null),
        c.posterKey ? createCachedSignedDownloadUrl(storage, c.posterKey, signOpts) : Promise.resolve(null),
      ])
      let fallbackSourceUrl: string | null = null
      let fallbackStartMs = c.startMs
      if (!previewUrl && !posterUrl) {
        if (c.sourceSegKey) {
          try {
            const segmentStorage = await getClipStorageForObjectKey(
              c.sourceSegKey,
              project!.upload?.storageDriver ?? null,
            )
            fallbackSourceUrl = await createCachedSignedDownloadUrl(segmentStorage, c.sourceSegKey, { versionHint })
            fallbackStartMs = Math.max(0, c.startMs - Number(c.sourceSegStartMs ?? c.startMs))
          } catch (error) {
            console.warn('[clips:cards] thumbnail segment_fallback_sign_failed', { clipId: c.id, error: String(error) })
          }
        }
        if (!fallbackSourceUrl && projectFallback) {
          fallbackSourceUrl = projectFallback.url
          fallbackStartMs = Math.max(0, c.startMs - projectFallback.offsetMs)
        }
      }
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
        fallbackSourceUrl,
        fallbackStartMs,
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
    if (!project!.transcriptKey) return null
    try {
      const driverHint = project!.upload?.storageDriver ?? null
      const tStorage = await getClipStorageForObjectKey(project!.transcriptKey, driverHint)
      const raw = await tStorage.getJson<unknown>(project!.transcriptKey)
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


/** Hub fast path: two DB reads instead of one project + one clip query per VOD.
 * Still signs and displays all clips in original VOD order and per-project score order.
 */
export async function listStreamerHubProjectClips(workspaceId: string, projectIds: string[]) {
  const ids = [...new Set(projectIds)]
  if (!ids.length) return []
  const prisma = getPrisma()
  const started = Date.now()
  const [projects, clips] = await Promise.all([
    prisma.clipProject.findMany({
      where: { id: { in: ids }, workspaceId, deletedAt: null },
      select: {
        id: true, settings: true, transcriptKey: true, proxyKey: true, rangeStartMs: true,
        upload: { select: { storageDriver: true, key: true } },
      },
    }),
    prisma.clip.findMany({
      where: { projectId: { in: ids }, deletedAt: null },
      orderBy: { score: 'desc' },
      select: listClipSelect,
    }),
  ])
  console.info('[page:timing]', {
    path: '/app/streamer', query: 'batched_project_and_clip_rows',
    elapsedMs: Date.now() - started, rows: clips.length, projects: projects.length,
  })
  const projectById = new Map(projects.map((project) => [project.id, project]))
  const clipsById = new Map<string, ClipListRow[]>()
  for (const clip of clips) {
    const group = clipsById.get(clip.projectId) ?? []
    group.push(clip)
    clipsById.set(clip.projectId, group)
  }
  const signStarted = Date.now()
  const lists = await Promise.all(projectIds.map((projectId) => {
    const project = projectById.get(projectId)
    return project
      ? listProjectClips(workspaceId, projectId, 'score', {
          skipTranscriptEnrichment: true, project,
          prefetchedClips: clipsById.get(projectId) ?? [],
        })
      : Promise.resolve(null)
  }))
  const visible = lists.flatMap((rows) => rows ?? [])
  console.info('[page:timing]', {
    path: '/app/streamer', query: 'clip_url_signing',
    elapsedMs: Date.now() - signStarted, rows: visible.length,
  })
  return visible
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
