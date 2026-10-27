import type { EdlSegment } from '@/lib/clips/script-edl/types'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { sourceMsToOutputTime } from '@/lib/clips/script-edl/derive-edl'
import type { TimelineWordChip } from '@/lib/clips/script-editor/timeline-model'

/** Word index after which a marker heading should render (marker sits before word idx+1). */
export function markerAfterWordIndex(
  chips: TimelineWordChip[],
  orderedWords: EditorWord[],
  edl: EdlSegment[],
  markerOutMs: number,
): number | null {
  const ms = Math.max(0, Math.round(markerOutMs))
  let best: number | null = null
  for (let i = 0; i < orderedWords.length; i++) {
    const chip = chips.find((c) => c.wordId === orderedWords[i].id)
    const outStart = chip?.outStartMs ?? sourceMsToOutputTime(orderedWords[i].t0Ms, edl)
    if (outStart == null) continue
    if (outStart <= ms) best = i
    else break
  }
  return best
}

export function markersByAfterWordIndex(
  document: { markers?: { id: string; outMs: number; label?: string; exportAsChapter?: boolean }[] },
  chips: TimelineWordChip[],
  orderedWords: EditorWord[],
  edl: EdlSegment[],
): Map<number, { id: string; outMs: number; label?: string; exportAsChapter?: boolean }[]> {
  const map = new Map<number, { id: string; outMs: number; label?: string; exportAsChapter?: boolean }[]>()
  for (const m of document.markers ?? []) {
    const idx = markerAfterWordIndex(chips, orderedWords, edl, m.outMs)
    if (idx == null) continue
    const list = map.get(idx) ?? []
    list.push(m)
    map.set(idx, list)
  }
  return map
}
