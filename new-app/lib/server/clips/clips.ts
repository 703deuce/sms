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

const CLIP_CARD_ROW_SIGN_CONCURRENCY = 4
const STREAMER_PROJECT_SIGN_CONCURRENCY = 3

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return []
  const out = new Array<R>(items.length)
  let nextIndex = 0
  const workerCount = Math.min(Math.max(1, concurrency), items.length)
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = nextIndex
        nextIndex += 1
        if (index >= items.length) return
        out[index] = await fn(items[index]!, index)
      }
    }),
  )
  return out
}

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

  const projectFallbackKey = project.proxyKey || project.upload?.key || null
  let projectFallbackPromise: Promise<{ url: string; offsetMs: number } | null> | null = null
  const loadProjectFallback = async () => {
    if (!projectFallbackKey) return null
    if (!projectFallbackPromise) {
      projectFallbackPromise = (async () => {
        try {
          const sourceStorage = await getClipStorageForObjectKey(
            projectFallbackKey,
            project!.upload?.storageDriver ?? null,
          )
          return {
            url: await createCachedSignedDownloadUrl(sourceStorage, projectFallbackKey, {
              versionHint: `clip-card-source:${projectId}`,
            }),
            offsetMs: project!.proxyKey ? Number(project!.rangeStartMs ?? 0) : 0,
          }
        } catch (fallbackError) {
          console.warn('[clips:cards] thumbnail source_fallback_sign_failed', {
            projectId,
            errorName: fallbackError instanceof Error ? fallbackError.name : 'UnknownError',
          })
          return null
        }
      })()
    }
    return projectFallbackPromise
  }

  const signStarted = Date.now()
  let mediaSignFailures = 0
  let rows = await mapWithConcurrency(
    visible,
    CLIP_CARD_ROW_SIGN_CONCURRENCY,
    async (c) => {
      const versionHint = c.updatedAt.toISOString()
      const signOpts = { versionHint }
      const signMedia = async (key: string, media: 'preview' | 'poster') => {
        try {
          return await createCachedSignedDownloadUrl(storage, key, signOpts)
        } catch (signError) {
          mediaSignFailures += 1
          console.warn('[clips:cards] media_sign_failed', {
            projectId,
            clipId: c.id,
            media,
            errorName: signError instanceof Error ? signError.name : 'UnknownError',
          })
          return null
        }
      }
      const [previewUrl, posterUrl] = await Promise.all([
        c.previewKey ? signMedia(c.previewKey, 'preview') : Promise.resolve(null),
        c.posterKey ? signMedia(c.posterKey, 'poster') : Promise.resolve(null),
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
          } catch (segmentError) {
            console.warn('[clips:cards] thumbnail segment_fallback_sign_failed', {
              clipId: c.id,
              errorName: segmentError instanceof Error ? segmentError.name : 'UnknownError',
            })
          }
        }
        if (!fallbackSourceUrl) {
          const projectFallback = await loadProjectFallback()
          if (projectFallback) {
            fallbackSourceUrl = projectFallback.url
            fallbackStartMs = Math.max(0, c.startMs - projectFallback.offsetMs)
          }
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
    },
  )
  console.info('[page:timing]', {
    path: '/app/clips/[projectId]',
    query: 'clip_url_signing',
    projectId,
    elapsedMs: Date.now() - signStarted,
    rows: rows.length,
    signFailures: mediaSignFailures,
    concurrency: CLIP_CARD_ROW_SIGN_CONCURRENCY,
  })

  if (opts?.skipTranscriptEnrichment) {

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
  const lists = await mapWithConcurrency(
    projectIds,
    STREAMER_PROJECT_SIGN_CONCURRENCY,
    async (projectId) => {
      const project = projectById.get(projectId)
      return project
        ? listProjectClips(workspaceId, projectId, 'score', {
            skipTranscriptEnrichment: true,
            project,
            prefetchedClips: clipsById.get(projectId) ?? [],
          })
        : null
    },
  )
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
