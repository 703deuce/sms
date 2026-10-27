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

    const token = normalizeToken(w.w ?? '')
    if (token && SCRIPT_FILLER_LEXICON.has(token)) {
      row.isFiller = true
      row.fillerKind = 'lexicon'
    } else if (markRepeated && i > 0) {
      const prevToken = normalizeToken(words[i - 1].w ?? '')
      if (token && token === prevToken && token.length > 1) {
        row.isFiller = true
        row.fillerKind = 'repeat'
      }
    }

    out.push(row)
  }
  return out
}

export function countEnrichedFillers(words: EnrichedClipWord[]): number {
  return words.filter((w) => w.isFiller).length
}
