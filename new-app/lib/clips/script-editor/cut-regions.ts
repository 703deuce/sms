import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

export type SourceCutRegion = {
  loMs: number
  hiMs: number
  wordIds: string[]
}

/** Contiguous deleted-word runs in transcript order, positioned in source time (relative to range start). */
export function sourceCutRegions(
  orderedWords: EditorWord[],
  deletedSet: Set<string>,
  rangeStartMs: number,
): SourceCutRegion[] {
  const regions: SourceCutRegion[] = []
  let run: { ids: string[]; lo: number; hi: number } | null = null

  const flush = () => {
    if (!run) return
    regions.push({
      loMs: run.lo,
      hiMs: run.hi,
      wordIds: run.ids,
    })
    run = null
  }

  for (const w of orderedWords) {
    if (!deletedSet.has(w.id)) {
      flush()
      continue
    }
    const lo = Math.max(0, w.t0Ms - rangeStartMs)
    const hi = Math.max(lo + 1, w.t1Ms - rangeStartMs)
    if (!run) run = { ids: [w.id], lo, hi }
    else {
      run.ids.push(w.id)
      run.hi = Math.max(run.hi, hi)
    }
  }
  flush()
  return regions
}
