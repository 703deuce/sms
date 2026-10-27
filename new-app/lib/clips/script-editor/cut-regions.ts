import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { sourceMsToOutputTime } from '@/lib/clips/script-edl/derive-edl'
import type { EdlSegment } from '@/lib/clips/script-edl/types'

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

/** Cut regions on the output (EDL) timeline for ruler overlays. */
export function outputCutRegions(
  orderedWords: EditorWord[],
  deletedSet: Set<string>,
  edl: EdlSegment[],
  rangeStartMs: number,
): SourceCutRegion[] {
  const regions: SourceCutRegion[] = []
  let run: { ids: string[]; lo: number; hi: number } | null = null

  const flush = () => {
    if (!run) return
    regions.push({ loMs: run.lo, hiMs: run.hi, wordIds: run.ids })
    run = null
  }

  for (const w of orderedWords) {
    if (!deletedSet.has(w.id)) {
      flush()
      continue
    }
    const out0 = sourceMsToOutputTime(w.t0Ms, edl)
    const out1 = sourceMsToOutputTime(w.t1Ms, edl)
    const lo = Math.max(0, out0 ?? w.t0Ms - rangeStartMs)
    const hi = Math.max(lo + 1, out1 ?? w.t1Ms - rangeStartMs)
    if (!run) run = { ids: [w.id], lo, hi }
    else {
      run.ids.push(w.id)
      run.hi = Math.max(run.hi, hi)
    }
  }
  flush()
  return regions
}
