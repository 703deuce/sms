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

export function clipWhySummary(meta: ClipAiMeta | null | undefined): string | null {
  if (!meta) return null
  const why = meta.pass1_why || meta.score_detail
  if (typeof why === 'string' && why.trim()) return why.trim()
  if (typeof meta.hook === 'string' && meta.hook.trim()) return meta.hook.trim()
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
