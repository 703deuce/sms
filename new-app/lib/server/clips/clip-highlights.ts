import 'server-only'

import { clipWhySummary, isClipUserHidden, type ClipAiMeta } from '@/lib/clips/clip-results-chips'
import { isFullVideoSettings } from '@/lib/clips/full-video'
import { clipReasonTag, type ReasonTag } from '@/lib/clips/reason-tag'
import { clipProjectSettingsSchema } from '@/lib/clips/settings'
import { attachReasonTagsToClips, projectTranscriptToSourceWords } from '@/lib/server/clips/clip-reason-tags'
import { getPrisma } from '@/lib/server/db'
import { getClipStorageForObjectKey } from '@/lib/storage'
import { normalizeTranscriptJson } from '@/lib/server/clips/editor-words'

export type FullVideoHighlightsPayload = {
  source: 'find' | 'project'
  status: string
  progress?: number | null
  foundProjectId?: string
  picks: {
    clipId: string
    title: string
    startMs: number
    endMs: number
    score: number
    reasonTag: ReasonTag
    why: string | null
    origin?: 'find' | 'clip'
    findJobId?: string
  }[]
}

const foundClipProjectSelect = {
  id: true,
  status: true,
  settings: true,
  transcriptKey: true,
  createdAt: true,
  uploadId: true,
  upload: { select: { storageDriver: true } },
} as const

export async function getFullVideoHighlights(
  workspaceId: string,
  fullVideoProjectId: string,
): Promise<FullVideoHighlightsPayload | null> {
  const prisma = getPrisma()
  const fv = await prisma.clipProject.findFirst({
    where: { id: fullVideoProjectId, workspaceId, deletedAt: null },
    select: { id: true, uploadId: true, settings: true },
  })
  if (!fv || !isFullVideoSettings(fv.settings)) return null

  const { latestFindClips } = await import('@/lib/server/clips/find-clips-job')
  const findJob = await latestFindClips(fullVideoProjectId)

  let found = (
    await prisma.clipProject.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: foundClipProjectSelect,
      take: 40,
    })
  ).find((p) => {
    const parsed = clipProjectSettingsSchema.safeParse(p.settings)
    return parsed.success && parsed.data.fromFullVideoProjectId === fullVideoProjectId
  })

  if (!found && fv.uploadId) {
    const candidates = await prisma.clipProject.findMany({
      where: { workspaceId, uploadId: fv.uploadId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: foundClipProjectSelect,
    })
    const fvCreated =
      (
        await prisma.clipProject.findUnique({
          where: { id: fullVideoProjectId },
          select: { createdAt: true },
        })
      )?.createdAt ?? new Date(0)
    found =
      candidates.find(
        (p) => !isFullVideoSettings(p.settings) && p.createdAt > fvCreated,
      ) ?? null
  }

  const findIsNewer =
    findJob &&
    (!found || findJob.createdAt >= found.createdAt)

  if (findIsNewer && findJob) {
    return {
      source: 'find',
      status: findJob.status,
      progress: findJob.progress,
      picks: findJob.picks,
    }
  }

  if (!found) return null

  const clips = await prisma.clip.findMany({
    where: { projectId: found.id, workspaceId, deletedAt: null },
    orderBy: { startMs: 'asc' },
  })

  let rows = clips
    .filter((c) => c.reason !== 'derived' && !isClipUserHidden(c.aiMeta))
    .map((c) => ({
      id: c.id,
      title: c.title,
      startMs: c.startMs,
      endMs: c.endMs,
      score: c.score,
      reason: c.reason,
      aiMeta: c.aiMeta,
    }))

  const needsTag = rows.some((c) => {
    const m = c.aiMeta as { reasonTag?: string } | null
    return m?.reasonTag !== 'speech' && m?.reasonTag !== 'visual' && m?.reasonTag !== 'both'
  })
  if (needsTag && found.transcriptKey) {
    try {
      const storage = await getClipStorageForObjectKey(
        found.transcriptKey,
        found.upload?.storageDriver ?? null,
      )
      const raw = await storage.getJson<unknown>(found.transcriptKey)
      const words = projectTranscriptToSourceWords(normalizeTranscriptJson(raw))
      if (words.length) rows = attachReasonTagsToClips(rows, words, found.settings)
    } catch {
      /* optional */
    }
  }

  const parsed = clipProjectSettingsSchema.safeParse(found.settings)
  const mode = parsed.success ? parsed.data.mode : undefined

  const picks = rows.map((c) => {
    const meta = (c.aiMeta && typeof c.aiMeta === 'object' ? c.aiMeta : {}) as ClipAiMeta
    const tag = clipReasonTag(meta, { wps: meta.wordsPerSec ?? 0, startMs: c.startMs, endMs: c.endMs, mode })
    const why = clipWhySummary(meta) ?? (c.reason && !c.reason.includes('fallback') ? c.reason : null)
    return {
      clipId: c.id,
      title: c.title,
      startMs: c.startMs,
      endMs: c.endMs,
      score: c.score,
      reasonTag: tag,
      why: why ? why.slice(0, 200) : null,
      origin: 'clip' as const,
    }
  })

  return { source: 'project', status: found.status, foundProjectId: found.id, picks }
}
