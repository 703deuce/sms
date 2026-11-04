import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs } from '@/lib/clips/source-words'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import { sourceToOutput, timebaseFor } from '@/lib/clips/editor/clip-timeline'

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
  const selected = words.filter((w) => {
    const { startMs: s, endMs: e } = wordSourceMs(w)
    return e > a && s < b
  })
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
