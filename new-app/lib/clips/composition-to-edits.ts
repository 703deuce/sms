import type { ClipEditsV2, CutRange } from '@/lib/clips/edits'
import { defaultEdits } from '@/lib/clips/edits'
import { deriveEdl } from '@/lib/clips/script-edl/derive-edl'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

/** Absolute source-ms cut ranges for regions removed by the composition document. */
export function cutRangesFromDocument(
  document: ScriptDocumentV1,
  wordsById: Map<string, EditorWord>,
  rangeStartMs: number,
  rangeEndMs: number,
): CutRange[] {
  const edl = deriveEdl(document, wordsById, { padMs: 0 })
  const cuts: CutRange[] = []
  let cursor = rangeStartMs
  for (const seg of edl) {
    if (seg.kind !== 'source') continue
    if (seg.srcInMs > cursor + 1) cuts.push([cursor, seg.srcInMs])
    cursor = Math.max(cursor, seg.srcOutMs)
  }
  if (cursor < rangeEndMs - 1) cuts.push([cursor, rangeEndMs])
  return cuts
}

export function clipEditsFromComposition(input: {
  document: ScriptDocumentV1
  wordsById: Map<string, EditorWord>
  rangeStartMs: number
  rangeEndMs: number
  baseEdits?: ClipEditsV2 | null
}): ClipEditsV2 {
  const bounds = { clipStartMs: input.rangeStartMs, clipEndMs: input.rangeEndMs }
  const edits = input.baseEdits ? { ...input.baseEdits } : defaultEdits(bounds)
  return {
    ...edits,
    v: 2,
    trim: { in: input.rangeStartMs, out: input.rangeEndMs },
    cutRanges: cutRangesFromDocument(input.document, input.wordsById, input.rangeStartMs, input.rangeEndMs),
  }
}
