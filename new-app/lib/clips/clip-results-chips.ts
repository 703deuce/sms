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
  /** #1111: true when a leftover non-critical draft was published for review. Absent on older clips. */
  needsReview?: boolean
  /** Up to 10 editorial/QA issue strings; empty when needsReview is not true. */
  needsReviewReasons?: string[]
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

const INTERNAL_PLANNING_RE =
  /\b(span confirms|pass-1|pass 1|gemini['']s?\s+\d|score_detail|two-sided critique)\b/i
const NUMERIC_SPAN_RE = /\d+\.?\d*\s*[-–—]\s*\d+\.?\d*\s*span/i
const LOWERCASE_FRAGMENT_TITLE_RE =
  /^(introduces|builds?|explores|discusses|covers|compares|argues|highlights|breaks down)\s+[a-z]/i

const GENERIC_CLIP_TITLES = new Set(['clip', 'clip moment', 'untitled', 'coverage_span', 'fallback_full_span'])

/** Placeholder picker titles — treat like missing headline. */
export function isGenericClipTitle(text: string | null | undefined): boolean {
  const t = (text || '').trim().toLowerCase()
  if (!t) return true
  return GENERIC_CLIP_TITLES.has(t)
}

/** Card fallback copy is constrained without clipping a spoken word in half. */
function clipHeadlineOnWordBoundary(text: string, maxLen = 120): string {
  const normalized = text.trim()
  if (normalized.length <= maxLen) return normalized
  const prefix = normalized.slice(0, maxLen + 1)
  const cut = prefix.lastIndexOf(' ')
  return cut > 0 ? prefix.slice(0, cut).trimEnd() : ''
}

const CLIP_TITLE_MAX_WORDS = 6

/** Short headline from spoken transcript (first words, trimmed at a word boundary). */
export function clipTitleFromTranscriptWords(
  text: string | null | undefined,
  maxWords: number = CLIP_TITLE_MAX_WORDS,
  maxLen = 120,
): string | null {
  const raw = (text || '').trim()
  if (!raw) return null
  const cleaned = stripClipTitleTimestampPrefix(stripInternalSentenceRefs(raw))
  if (!cleaned || isInternalClipReasoningText(cleaned)) return null
  const words = cleaned.split(/\s+/).filter(Boolean)
  if (!words.length) return null
  let title = words.slice(0, maxWords).join(' ')
  if (title.length > maxLen) {
    title = title.slice(0, maxLen).replace(/\s+\S*$/, '').trim()
  }
  return title.length >= 3 ? title : null
}

function looksTruncatedPlanningTitle(text: string): boolean {
  const t = text.trim()
  if (t.length < 72) return false
  if (/[.?!]["')\]]\s*$/.test(t)) return false
  const words = t.split(/\s+/)
  const last = words[words.length - 1] ?? ''
  if (last.length <= 3 && !/[.?!]/.test(last)) return true
  return /,\s*(and|or)\s+[a-z]{1,3}$/i.test(t) || /\b(between|and|the|di)$/i.test(last)
}

function looksLikeSegmentPlanningNotes(text: string): boolean {
  const t = text.toLowerCase()
  if (INTERNAL_PLANNING_RE.test(text)) return true
  if (NUMERIC_SPAN_RE.test(text)) return true
  if (LOWERCASE_FRAGMENT_TITLE_RE.test(text.trim())) return true
  if (looksTruncatedPlanningTitle(text)) return true
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
    t.includes('span confirms') ||
    t.includes('two-sided critique') ||
    (/\bpass-?1\b/.test(t) && t.includes('segment')) ||
    (/\bat s\d+/i.test(raw) && (t.includes(' and ') || t.includes(' may ')))
  )
}

/** Customer-facing description lines — same leak rules as titles. */
export function sanitizeClipDescriptionText(text: string): string | null {
  const raw = text.trim()
  if (!raw || isInternalClipReasoningText(raw)) return null
  const cleaned = stripClipTitleTimestampPrefix(stripInternalSentenceRefs(raw))
  if (!cleaned || isInternalClipReasoningText(cleaned) || isHedgeOrDebugSummary(cleaned)) return null
  return cleaned
}

/** Customer-facing title for grids/cards — never raw timestamp-prefixed picker strings. */
export function clipDisplayTitle(clip: {
  title: string
  reason?: string | null
  aiMeta?: unknown
  spokenFirstLine?: string | null
}): string {
  const meta = (clip.aiMeta && typeof clip.aiMeta === 'object' ? clip.aiMeta : {}) as ClipAiMeta
  const rawTitle = clip.title.trim()

  if (
    rawTitle &&
    !isGenericClipTitle(rawTitle) &&
    !isTimestampPrefixedClipTitle(rawTitle) &&
    !isInternalClipReasoningText(rawTitle)
  ) {
    return rawTitle
  }

  if (!isInternalClipReasoningText(rawTitle)) {
    const titleAfterStrip = stripClipTitleTimestampPrefix(stripInternalSentenceRefs(rawTitle))
    if (
      titleAfterStrip &&
      !isInternalClipReasoningText(titleAfterStrip) &&
      !isGenericClipTitle(titleAfterStrip)
    ) {
      const headline = clipHeadlineOnWordBoundary(titleAfterStrip)
      if (headline) return headline
    }
  }

  const why = clipWhySummary(meta)
  if (why) {
    const headline = clipHeadlineOnWordBoundary(why)
    if (headline) return headline
  }

  const reason = clip.reason?.trim()
  if (reason && !FALLBACK_REASON_RE.test(reason)) {
    const cleaned = stripClipTitleTimestampPrefix(reason)
    if (cleaned && !isInternalClipReasoningText(cleaned)) {
      const headline = clipHeadlineOnWordBoundary(cleaned)
      if (headline) return headline
    }
  }

  if (typeof meta.hook === 'string') {
    const hook = stripClipTitleTimestampPrefix(meta.hook.trim())
    if (hook && !isInternalClipReasoningText(hook) && !isGenericClipTitle(hook)) {
      const headline = clipHeadlineOnWordBoundary(hook)
      if (headline) return headline
    }
  }

  const fromTranscript = clipTitleFromTranscriptWords(clip.spokenFirstLine)
  if (fromTranscript) return fromTranscript

  return 'Clip'
}

export function clipWhySummary(meta: ClipAiMeta | null | undefined): string | null {
  if (!meta) return null
  if (typeof meta.videoWhy === 'string' && meta.videoWhy.trim()) {
    const v = sanitizeClipDescriptionText(meta.videoWhy.trim())
    if (v) return v
  }
  const candidates = [meta.hook, meta.score_detail, meta.pass1_why]
  for (const c of candidates) {
    if (typeof c !== 'string') continue
    const trimmed = sanitizeClipDescriptionText(c.trim())
    if (trimmed) return trimmed
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
  const reason = clip.reason?.trim()
  if (reason) {
    const cleanedReason = sanitizeClipDescriptionText(reason)
    if (cleanedReason && !FALLBACK_REASON_RE.test(cleanedReason)) lines.push(cleanedReason)
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
