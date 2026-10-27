import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

export type FillerFilter = 'all' | 'lexicon' | 'repeat'

export type FillerHit = {
  word: EditorWord
  index: number
}

export function listFillerHits(
  orderedWords: EditorWord[],
  deletedSet: Set<string>,
  opts?: {
    filter?: FillerFilter
    selectionOnly?: boolean
    selectedIds?: Set<string>
    avoidHarshCuts?: boolean
  },
): FillerHit[] {
  const filter = opts?.filter ?? 'all'
  const hits: FillerHit[] = []
  for (let i = 0; i < orderedWords.length; i++) {
    const w = orderedWords[i]
    if (!w.isFiller || deletedSet.has(w.id)) continue
    if (filter === 'lexicon' && w.fillerKind !== 'lexicon') continue
    if (filter === 'repeat' && w.fillerKind !== 'repeat') continue
    if (opts?.selectionOnly && opts.selectedIds && !opts.selectedIds.has(w.id)) continue
    if (opts?.avoidHarshCuts) {
      const prev = orderedWords[i - 1]
      const next = orderedWords[i + 1]
      if (prev && !deletedSet.has(prev.id) && w.t0Ms - prev.t1Ms < 40) continue
      if (next && !deletedSet.has(next.id) && next.t0Ms - w.t1Ms < 40) continue
    }
    hits.push({ word: w, index: i })
  }
  return hits
}

export function formatGapChip(gapMs: number): string {
  const sec = gapMs / 1000
  if (sec >= 10) return `•••${sec.toFixed(0)}s`
  return `•••${sec.toFixed(1)}s`
}
