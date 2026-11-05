import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs } from '@/lib/clips/source-words'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import { sourceToOutput, timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { orderedKeepSegments } from '@/lib/clips/edits'

/** Select only spoken words whose center belongs to the selected range.
 * A transcript model can assign overlapping edges to adjacent tokens; overlap
 * alone must not silently include an unselected neighbouring word.
 */
export function wordsSelectedByMidpoint(words: SourceWord[], startMs: number, endMs: number): SourceWord[] {
  const a = Math.min(startMs, endMs)
  const b = Math.max(startMs, endMs)
  return words.filter((w) => {
    const { midMs } = wordSourceMs(w)
    return midMs >= a && midMs < b
  }).sort((x, y) => x.s - y.s || x.i - y.i)
}

/** A1: Transcript selection is in absolute SOURCE milliseconds, not output-relative time. */
export function transcriptCutForSelection(
  edits: ClipEditsV2,
  words: SourceWord[],
  startMs: number,
  endMs: number,
): { range: [number, number]; atOutputMs: number } | null {
  const a = Math.min(startMs, endMs)
  const b = Math.max(startMs, endMs)
  if (a === b) return null
  const selected = wordsSelectedByMidpoint(words, a, b)
  if (!selected.length) return null
  const first = wordSourceMs(selected[0]!)
  const last = wordSourceMs(selected[selected.length - 1]!)
  const cutStart = Math.round(first.startMs)
  const cutEnd = Math.round(last.endMs)
  if (cutEnd <= cutStart || cutStart < edits.trim.in || cutEnd > edits.trim.out) return null
  const tb = timebaseFor(editorPreviewEdits(edits, words))
  const atOutputMs = sourceToOutput(tb, cutStart)
  const lastOutputMs = sourceToOutput(tb, cutEnd - 1)
  if (atOutputMs == null || lastOutputMs == null) return null
  return { range: [cutStart, cutEnd], atOutputMs }
}

/** N6: struck-through words must match source frames actually removed from the
 * output, not merely overlap a historical cut range at one edge of a word.
 * Use the same ordered source-keep segments as the render timebase; do not
 * rewrite/delete saved edits from old editor versions. */
export function transcriptWordRemovedFromVideo(edits: ClipEditsV2, word: SourceWord): boolean {
  if (!edits.cutRanges?.length) return false
  const { midMs } = wordSourceMs(word)
  if (midMs < edits.trim.in || midMs >= edits.trim.out) return false
  return !orderedKeepSegments(edits).some(([a, b]) => midMs >= a && midMs < b)
}
