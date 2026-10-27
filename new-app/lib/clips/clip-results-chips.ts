/** Result grid chips and tooltips from clip picker / render metadata. */

export type ClipAiMeta = {
  hook?: string
  pass1_why?: string
  score_detail?: string | Record<string, unknown>
  cropMethod?: string
  layoutMode?: string
  layoutResolved?: string
  nPersons?: number
  personCount?: number
}

const LAYOUT_LABELS: Record<string, string> = {
  speaker_follow: 'Speaker follow',
  subject_follow: 'Subject follow',
  fit_blur: 'Fit + blur',
  multiperson: 'Multi-person',
  dynamic: 'Dynamic',
  split: 'Split',
  grid3: 'Grid 3-up',
  grid4: 'Grid 4-up',
}

export function clipWhySummary(meta: ClipAiMeta | null | undefined): string | null {
  if (!meta) return null
  const why = meta.pass1_why
  if (typeof why === 'string' && why.trim()) return why.trim()
  const detail = meta.score_detail
  if (typeof detail === 'string' && detail.trim()) return detail.trim()
  if (typeof meta.hook === 'string' && meta.hook.trim()) return meta.hook.trim()
  return null
}

export function clipLayoutChip(meta: ClipAiMeta | null | undefined): string | null {
  if (!meta) return null
  const raw = meta.layoutResolved || meta.layoutMode || meta.cropMethod || ''
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
