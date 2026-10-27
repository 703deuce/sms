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
  userHidden?: boolean
  userFeedback?: 'dislike' | null
  signals?: { sentence?: number }[]
}

const LAYOUT_LABELS: Record<string, string> = {
  speaker_follow: 'Speaker follow',
  subject_follow: 'Subject follow',
  fit_blur: 'Fit + blur',
  multiperson: 'Multi-person',
  screen_pip: 'Screen + cam',
  side: 'Side by side',
  two_up: '2-up',
  three_up: '3-up',
  four_up: '4-up',
}

const SENTENCE_REF_RE = /\(\s*s\d+(?:\s*-\s*s\d+)?\s*\)/gi

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

export function clipWhySummary(meta: ClipAiMeta | null | undefined): string | null {
  if (!meta) return null
  const candidates = [meta.pass1_why, meta.hook, meta.score_detail]
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
