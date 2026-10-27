import type { ClipWord } from '@/lib/clips/edits'

/** Align with worker `picker/snap_bounds.py` FILLERS (single-token). */
export const SCRIPT_FILLER_LEXICON = new Set([
  'um',
  'uh',
  'erm',
  'so',
  'and',
  'but',
  'like',
  'okay',
  'ok',
  'right',
  'no',
  'yeah',
  'yes',
  'yep',
  'mhm',
  'exactly',
  'totally',
  'sure',
  'wow',
  'oh',
  'ah',
  'well',
  'literally',
  'basically',
  'actually',
])

const NORM = /[^\w\s']/g

/** Deepgram / clip JSON may use `w`, `word`, or `text`. */
export function clipWordSurfaceText(word: ClipWord & Record<string, unknown>): string {
  const raw = word.w ?? word.word ?? word.text
  return typeof raw === 'string' ? raw : ''
}

export function normalizeToken(w: string): string {
  return w.toLowerCase().replace(NORM, '').trim()
}

export type EnrichOpts = {
  gapThresholdMs?: number
  markRepeated?: boolean
}

export type EnrichedClipWord = ClipWord & {
  isFiller?: boolean
  fillerKind?: 'lexicon' | 'repeat' | 'silence'
  gapBeforeMs?: number
}

/** Additive enrichment for stored transcript JSON (spec §B3 v1). */
export function enrichTranscriptWords(words: ClipWord[], opts?: EnrichOpts): EnrichedClipWord[] {
  const gapThresholdMs = opts?.gapThresholdMs ?? 750
  const markRepeated = opts?.markRepeated ?? true
  const out: EnrichedClipWord[] = []

  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const row: EnrichedClipWord = { ...w }
    const t0 = Math.round((w.s ?? 0) * 1000)
    const prev = i > 0 ? words[i - 1] : null
    if (prev) {
      const prevEnd = Math.round((prev.e ?? 0) * 1000)
      const gap = Math.max(0, t0 - prevEnd)
      if (gap >= gapThresholdMs) row.gapBeforeMs = gap
    }

    const surface = clipWordSurfaceText(w as ClipWord & Record<string, unknown>)
    const token = normalizeToken(surface)
    if (token && SCRIPT_FILLER_LEXICON.has(token)) {
      row.isFiller = true
      row.fillerKind = 'lexicon'
    } else if (markRepeated && i > 0) {
      const prevToken = normalizeToken(
        clipWordSurfaceText(words[i - 1] as ClipWord & Record<string, unknown>),
      )
      if (token && token === prevToken && token.length > 1) {
        row.isFiller = true
        row.fillerKind = 'repeat'
      }
    }

    out.push(row)
  }

  for (let i = 0; i < out.length - 1; i++) {
    const a = normalizeToken(clipWordSurfaceText(out[i] as ClipWord & Record<string, unknown>))
    const b = normalizeToken(clipWordSurfaceText(out[i + 1] as ClipWord & Record<string, unknown>))
    if (a === 'you' && b === 'know') {
      out[i].isFiller = true
      out[i].fillerKind = 'lexicon'
      out[i + 1].isFiller = true
      out[i + 1].fillerKind = 'lexicon'
    }
  }

  return out
}

export function countEnrichedFillers(words: EnrichedClipWord[]): number {
  return words.filter((w) => w.isFiller).length
}
