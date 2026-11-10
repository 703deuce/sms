/**
 * Unified clipper results adapter against docs/contracts/unified-clipper-v1.md
 * (New draft PR #1138, head 880194ec). Maps GET /api/ai-producer-agent/runs/:id/clips
 * and the existing project clip list. Does not re-dedupe (>60% overlap is backend).
 *
 * Frontend sends storyMode / autoAgentClipMode: 'clip_unified_v1'.
 * #1138 is not merged; auto-start of that job is a merge-order dependency.
 */

export type UnifiedClipKind = 'story' | 'continuous'

/** Posted contract value. New Frontend should send only clip_unified_v1. */
export const UNIFIED_AUTO_AGENT_CLIP_MODE = 'clip_unified_v1' as const

export type UnifiedClipTypeFilter = 'all' | UnifiedClipKind
export type UnifiedClipSort = 'score' | 'type' | 'duration' | 'timeline' | 'title'

export type UnifiedClipResult = {
  id: string
  projectId?: string
  title: string
  score: number
  scores: unknown
  durationMs: number
  startMs: number
  endMs: number
  previewUrl: string | null
  posterUrl: string | null
  fallbackSourceUrl?: string | null
  fallbackStartMs?: number
  reason?: string | null
  aiMeta?: unknown
  edits?: unknown
  spokenFirstLine?: string
  favorite?: boolean
  /** Story (stitched beats) or Continuous (uninterrupted 15–30s, up to ~60s). */
  resultKind: UnifiedClipKind
  needsReview?: boolean
  needsReviewReasons?: string[]
}

const STORY_VALUES = new Set([
  'story',
  'clip_story',
  'clip_story_v1',
  'stitched',
  'multi_moment',
])

const CONTINUOUS_VALUES = new Set([
  'continuous',
  'moment',
  'clip_moment',
  'clip_moment_v1',
  'single_moment',
])

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

function normalizeKindToken(raw: string | null): UnifiedClipKind | null {
  if (!raw) return null
  const key = raw.toLowerCase().replace(/\s+/g, '_')
  if (STORY_VALUES.has(key)) return 'story'
  if (CONTINUOUS_VALUES.has(key)) return 'continuous'
  return null
}

function kindFromTitle(title: string): UnifiedClipKind | null {
  const t = title.toLowerCase()
  if (/\bai story clip\b/.test(t) || /\bstory clip\b/.test(t)) return 'story'
  if (/\bai moment clip\b/.test(t) || /\bcontinuous\b/.test(t)) return 'continuous'
  return null
}

function kindFromEdits(edits: unknown): UnifiedClipKind | null {
  const rec = asRecord(edits)
  if (!rec) return null
  const sources = rec.sources ?? rec.cuts ?? rec.segments
  if (Array.isArray(sources) && sources.length > 1) return 'story'
  return null
}

/**
 * Infer Story vs Continuous from the posted contract field when present,
 * otherwise from known agent metadata / titles / stitched sources.
 * When nothing identifies the clip, lean Story (product default).
 */
export function inferUnifiedClipKind(raw: unknown): UnifiedClipKind {
  const row = asRecord(raw) ?? {}
  const meta = asRecord(row.aiMeta)
  const fromContract = normalizeKindToken(
    firstString(row.type, row.kind, row.resultKind, row.resultType, row.clipKind),
  )
  if (fromContract) return fromContract
  const fromMeta = normalizeKindToken(
    firstString(
      meta?.type,
      meta?.kind,
      meta?.resultKind,
      meta?.clipKind,
      meta?.storyMode,
      meta?.clipAgentMode,
      meta?.mode,
    ),
  )
  if (fromMeta) return fromMeta
  const title = typeof row.title === 'string' ? row.title : ''
  const fromTitle = kindFromTitle(title)
  if (fromTitle) return fromTitle
  const fromEdits = kindFromEdits(row.edits)
  if (fromEdits) return fromEdits
  return 'story'
}

export function adaptListProjectClip(raw: unknown): UnifiedClipResult | null {
  const row = asRecord(raw)
  const id = firstString(row?.id, row?.clipId)
  if (!row || !id) return null
  const startMs = firstNumber(row.startMs) ?? 0
  const endMs = firstNumber(row.endMs) ?? startMs
  const durationSeconds = firstNumber(row.durationSeconds)
  const durationMs = firstNumber(row.durationMs) ?? (durationSeconds != null ? Math.round(durationSeconds * 1000) : Math.max(0, endMs - startMs))
  const title = typeof row.title === 'string' && row.title.trim() ? row.title : 'Untitled clip'
  const resultKind = inferUnifiedClipKind(row)
  const meta = asRecord(row.aiMeta)
  const needsReview = row.needsReview === true || meta?.needsReview === true
  const reasonRaw = row.needsReviewReasons ?? meta?.needsReviewReasons
  const needsReviewReasons = Array.isArray(reasonRaw)
    ? reasonRaw.filter((r): r is string => typeof r === 'string' && r.trim().length > 0).slice(0, 10)
    : []
  const aiMeta = {
    ...(meta ?? {}),
    type: resultKind,
    ...(needsReview ? { needsReview: true, needsReviewReasons } : {}),
  }
  return {
    id,
    projectId: typeof row.projectId === 'string' ? row.projectId : undefined,
    title,
    score: firstNumber(row.score) ?? 0,
    scores: row.scores ?? null,
    durationMs,
    startMs,
    endMs,
    // #1138 run results omit media URLs (backend gap). Accept aliases from the
    // project clip list or any payload that does include them.
    previewUrl: firstString(row.previewUrl, row.playbackUrl, row.videoUrl, row.mediaUrl, row.src),
    posterUrl: firstString(row.posterUrl, row.thumbnailUrl, row.thumbUrl, row.previewImageUrl, row.imageUrl),
    fallbackSourceUrl: firstString(row.fallbackSourceUrl),
    fallbackStartMs: firstNumber(row.fallbackStartMs) ?? undefined,
    reason: typeof row.reason === 'string' ? row.reason : row.reason == null ? null : undefined,
    aiMeta,
    edits: row.edits,
    spokenFirstLine: typeof row.spokenFirstLine === 'string' ? row.spokenFirstLine : undefined,
    favorite: row.favorite === true,
    resultKind,
    needsReview,
    needsReviewReasons,
  }
}

export function adaptListProjectClips(raw: unknown): UnifiedClipResult[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(asRecord(raw)?.clips)
      ? (asRecord(raw)!.clips as unknown[])
      : []
  return list.map(adaptListProjectClip).filter((c): c is UnifiedClipResult => c != null)
}

export function filterSortUnifiedClips(
  clips: UnifiedClipResult[],
  opts: { type?: UnifiedClipTypeFilter; sort?: UnifiedClipSort } = {},
): UnifiedClipResult[] {
  const type = opts.type ?? 'all'
  const sort = opts.sort ?? 'score'
  const filtered = type === 'all' ? clips.slice() : clips.filter((c) => c.resultKind === type)
  filtered.sort((a, b) => {
    if (sort === 'timeline') return a.startMs - b.startMs
    if (sort === 'title') return a.title.localeCompare(b.title)
    if (sort === 'duration') return b.durationMs - a.durationMs
    if (sort === 'type') {
      if (a.resultKind !== b.resultKind) return a.resultKind === 'story' ? -1 : 1
      return b.score - a.score
    }
    return b.score - a.score
  })
  return filtered
}

export function unifiedClipCounts(clips: UnifiedClipResult[]): {
  total: number
  story: number
  continuous: number
} {
  let story = 0
  let continuous = 0
  for (const clip of clips) {
    if (clip.resultKind === 'story') story += 1
    else continuous += 1
  }
  return { total: clips.length, story, continuous }
}

/** Mocked list for tests and screenshots. Never triggers a paid clip job. */
export const MOCK_UNIFIED_CLIPS: UnifiedClipResult[] = [
  {
    id: 'clip_story_hook',
    projectId: 'proj_demo',
    title: 'The hook that sold the room',
    score: 94,
    scores: { hook: 96, flow: 91 },
    durationMs: 48_200,
    startMs: 12_400,
    endMs: 60_600,
    previewUrl: 'https://example.com/previews/story-hook.mp4',
    posterUrl: 'https://example.com/posters/story-hook.jpg',
    reason: 'Stitched setup, payoff, and audience reaction.',
    spokenFirstLine: 'Nobody saw this coming — and that is the point.',
    resultKind: 'story',
  },
  {
    id: 'clip_continuous_laugh',
    projectId: 'proj_demo',
    title: 'Unbroken laugh from the couch',
    score: 88,
    scores: { energy: 90 },
    durationMs: 22_500,
    startMs: 188_000,
    endMs: 210_500,
    previewUrl: 'https://example.com/previews/continuous-laugh.mp4',
    posterUrl: 'https://example.com/posters/continuous-laugh.jpg',
    reason: 'One uninterrupted 15–30s beat.',
    spokenFirstLine: 'Wait, say that again.',
    resultKind: 'continuous',
  },
  {
    id: 'clip_story_arc',
    projectId: 'proj_demo',
    title: 'Three beats, one argument',
    score: 81,
    scores: { narrative: 84 },
    durationMs: 57_000,
    startMs: 301_000,
    endMs: 358_000,
    previewUrl: 'https://example.com/previews/story-arc.mp4',
    posterUrl: 'https://example.com/posters/story-arc.jpg',
    reason: 'Story clip assembled from multiple moments.',
    resultKind: 'story',
  },
  {
    id: 'clip_continuous_insight',
    projectId: 'proj_demo',
    title: 'The 20-second insight',
    score: 76,
    scores: { clarity: 80 },
    durationMs: 19_800,
    startMs: 420_000,
    endMs: 439_800,
    previewUrl: 'https://example.com/previews/continuous-insight.mp4',
    posterUrl: 'https://example.com/posters/continuous-insight.jpg',
    reason: 'Continuous clip, self-contained.',
    resultKind: 'continuous',
  },
]
