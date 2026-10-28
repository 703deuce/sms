/** Result grid chips and tooltips from clip picker / render metadata. */

export type ClipAiMeta = {
  hook?: string
  pass1_why?: string
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
  return text.replace(SENTENCE_REF_RE, '').replace(/\s{2,}/g, ' ').trim()
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

  const titleAfterStrip = stripClipTitleTimestampPrefix(rawTitle)
  if (titleAfterStrip && !isInternalClipReasoningText(titleAfterStrip)) {
    return titleAfterStrip.slice(0, 120)
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
  const candidates = [meta.hook, meta.score_detail]
  for (const c of candidates) {
    if (typeof c !== 'string') continue
    const trimmed = stripInternalSentenceRefs(c.trim())
    if (!trimmed || isHedgeOrDebugSummary(trimmed)) continue
    return trimmed
  }
  return null
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
