import { clipReasonTag, reasonTagLabel, type ReasonTag } from '@/lib/clips/reason-tag'

export type ClipAiMeta = {
  hook?: string
  pass1_why?: string
  clipType?: string
  hasFacecam?: boolean
  facecamConfidence?: number
  score_detail?: string
  cropMethod?: string
  layoutMode?: string
  layoutResolved?: string
  nPersons?: number
  personCount?: number
  low_confidence?: boolean
  userHidden?: boolean
  userFeedback?: 'dislike' | null
  signals?: { sentence?: number }[]
  reasonTag?: 'speech' | 'visual' | 'both'
  videoWhy?: string
  wordsPerSec?: number
  videoMomentMatchIou?: number
}

const FALLBACK_REASON_RE =
  /fallback|emergency|short_source|short-source|span fallback|coverage_span/i

/** Picker fallback / emergency picks — still exportable; label in results grid. */
export function clipIsFallbackPick(
  meta: ClipAiMeta | null | undefined,
  reason?: string | null,
): boolean {
  if (meta?.low_confidence) return true
  const r = (reason || '').trim()
  return Boolean(r && FALLBACK_REASON_RE.test(r))
}

export function clipFallbackPickLabel(
  meta: ClipAiMeta | null | undefined,
  reason?: string | null,
): string | null {
  if (!clipIsFallbackPick(meta, reason)) return null
  const r = (reason || '').toLowerCase()
  if (r.includes('emergency') || r.includes('short_source')) return 'Fallback pick'
  if (r.includes('span')) return 'Span fallback'
  return 'Fallback pick'
}

const LAYOUT_LABELS: Record<string, string> = {
  speaker_follow: 'Speaker follow',
  subject_follow: 'Subject follow',
  fit_blur: 'Fit + blur',
  fit_top: 'Headline top',
  full_frame: 'Full frame',
  multiperson: 'Multi-person',
  screen_pip: 'Screen + cam',
  side: 'Side by side',
  two_up: '2-up',
  three_up: '3-up',
  four_up: '4-up',
}

const SENTENCE_REF_RE = /\(\s*s\d+(?:\s*-\s*s\d+)?\s*\)/gi
const BARE_SEGMENT_REF_RE = /\bs\d+(?:\s*-\s*s\d+)?\b/gi

/** Worker/debug titles like `00:30.0–01:20.6; hook text…` — not for card headlines. */
const CLIP_TITLE_TIMESTAMP_PREFIX_RE =
  /^\d{1,2}:\d{2}(?:\.\d+)?\s*[–—-]\s*\d{1,2}:\d{2}(?:\.\d+)?\s*(?:[;,]\s*)?/i

export function stripClipTitleTimestampPrefix(text: string): string {
  return text.trim().replace(CLIP_TITLE_TIMESTAMP_PREFIX_RE, '').trim()
}

export function isTimestampPrefixedClipTitle(text: string): boolean {
  return CLIP_TITLE_TIMESTAMP_PREFIX_RE.test(text.trim())
}

function stripInternalSentenceRefs(text: string): string {
  return text
    .replace(SENTENCE_REF_RE, '')
    .replace(BARE_SEGMENT_REF_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function looksLikeSegmentPlanningNotes(text: string): boolean {
  const t = text.toLowerCase()
  if (!BARE_SEGMENT_REF_RE.test(text)) return false
  BARE_SEGMENT_REF_RE.lastIndex = 0
  return (
    t.includes('introduces') ||
    t.includes('build a') ||
    t.includes('build the') ||
    t.includes('segment') ||
    (text.match(BARE_SEGMENT_REF_RE)?.length ?? 0) >= 2
  )
}

function isHedgeOrDebugSummary(text: string): boolean {
  const t = text.toLowerCase()
  return (
    t.includes('may contain') ||
    t.includes('context or payoff') ||
    t.includes('make it coherent') ||
    t.includes('needed to make it coherent')
  )
}

/** Picker / pass-1 reasoning — not for headlines, hooks, or export burn-in. */
export function isInternalClipReasoningText(text: string): boolean {
  const raw = text.trim()
  if (!raw) return true
  if (isTimestampPrefixedClipTitle(raw)) return true
  if (SENTENCE_REF_RE.test(raw)) return true
  if (looksLikeSegmentPlanningNotes(raw)) return true
  const trimmed = stripInternalSentenceRefs(raw)
  if (!trimmed || isHedgeOrDebugSummary(trimmed)) return true
  const t = trimmed.toLowerCase()
  return (
    t.startsWith('the laugh at') ||
    t.includes('may mark') ||
    t.includes('excited delivery at') ||
    (/\bat s\d+/i.test(raw) && (t.includes(' and ') || t.includes(' may ')))
  )
}

/** Customer-facing title for grids/cards — never raw timestamp-prefixed picker strings. */
export function clipDisplayTitle(clip: {
  title: string
  reason?: string | null
  aiMeta?: unknown
}): string {
  const meta = (clip.aiMeta && typeof clip.aiMeta === 'object' ? clip.aiMeta : {}) as ClipAiMeta
  const rawTitle = clip.title.trim()

  if (rawTitle && !isTimestampPrefixedClipTitle(rawTitle) && !isInternalClipReasoningText(rawTitle)) {
    return rawTitle
  }

  if (!isInternalClipReasoningText(rawTitle)) {
    const titleAfterStrip = stripClipTitleTimestampPrefix(stripInternalSentenceRefs(rawTitle))
    if (titleAfterStrip && !isInternalClipReasoningText(titleAfterStrip)) {
      return titleAfterStrip.slice(0, 120)
    }
  }

  const why = clipWhySummary(meta)
  if (why) return why.slice(0, 120)

  const reason = clip.reason?.trim()
  if (reason && !FALLBACK_REASON_RE.test(reason)) {
    const cleaned = stripClipTitleTimestampPrefix(reason)
    if (cleaned && !isInternalClipReasoningText(cleaned)) return cleaned.slice(0, 120)
  }

  if (typeof meta.hook === 'string') {
    const hook = stripClipTitleTimestampPrefix(meta.hook.trim())
    if (hook && !isInternalClipReasoningText(hook)) return hook.slice(0, 120)
  }

  return 'Clip'
}

export function clipWhySummary(meta: ClipAiMeta | null | undefined): string | null {
  if (!meta) return null
  if (typeof meta.videoWhy === 'string' && meta.videoWhy.trim()) {
    const v = stripInternalSentenceRefs(meta.videoWhy.trim())
    if (v && !isHedgeOrDebugSummary(v) && !isInternalClipReasoningText(v)) return v
  }
  const candidates = [meta.hook, meta.score_detail]
  for (const c of candidates) {
    if (typeof c !== 'string') continue
    const trimmed = stripInternalSentenceRefs(c.trim())
    if (!trimmed || isHedgeOrDebugSummary(trimmed)) continue
    return trimmed
  }
  return null
}

export function clipScoreTooltipLines(clip: {
  score: number
  scores?: unknown
  reason?: string | null
  aiMeta?: unknown
  startMs?: number
  endMs?: number
}): string[] {
  const meta = (clip.aiMeta && typeof clip.aiMeta === 'object' ? clip.aiMeta : {}) as ClipAiMeta
  const scores = (clip.scores && typeof clip.scores === 'object' ? clip.scores : {}) as Record<string, string>
  const tag = clipReasonTag(meta, {
    wps: 0,
    startMs: clip.startMs ?? 0,
    endMs: clip.endMs ?? 0,
  })
  const lines: string[] = [`Score ${clip.score}`, reasonTagLabel(tag)]
  const why = clipWhySummary(meta)
  if (!why && clip.reason && !isInternalClipReasoningText(clip.reason)) {
    const r = clip.reason.trim()
    if (r) lines.push(r)
  } else if (why) {
    lines.push(why)
  }
  for (const [k, v] of [
    ['Hook', scores.hook],
    ['Flow', scores.flow],
    ['Value', scores.value],
    ['Trend', scores.trend],
  ] as const) {
    if (v) lines.push(`${k}: ${v}`)
  }
  return lines
}

export { reasonTagLabel, type ReasonTag }

const CLIP_TYPE_LABELS: Record<string, string> = {
  gaming: 'Gaming',
  irl: 'IRL',
  just_chatting: 'Just Chatting',
  podcast: 'Podcast',
  other: 'Other',
}

export function clipTypeBadge(meta: ClipAiMeta | null | undefined): string | null {
  if (!meta?.clipType) return null
  const key = String(meta.clipType).toLowerCase()
  return CLIP_TYPE_LABELS[key] || key.replace(/_/g, ' ')
}

export function clipLayoutChip(meta: ClipAiMeta | null | undefined): string | null {
  if (!meta) return null
  const raw =
    meta.layoutResolved ||
    meta.layoutMode ||
    meta.cropMethod ||
    ''
  const key = String(raw).toLowerCase().replace(/\s+/g, '_')
  if (!key) return null
  return LAYOUT_LABELS[key] || raw.replace(/_/g, ' ')
}

export function clipPersonCount(meta: ClipAiMeta | null | undefined): number | null {
  if (!meta) return null
  if (typeof meta.nPersons === 'number' && meta.nPersons > 0) return meta.nPersons
  if (typeof meta.personCount === 'number' && meta.personCount > 0) return meta.personCount
  return null
}

export function isClipUserHidden(meta: unknown): boolean {
  return Boolean((meta as ClipAiMeta | null)?.userHidden)
}
