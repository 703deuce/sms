import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { buildDocumentFromDeletes } from '@/lib/clips/script-edl/derive-edl'

/** Map clip cut ranges (absolute source ms) to deleted editor word ids. */
export function deletedWordIdsFromCutRanges(
  words: EditorWord[],
  cutRanges: [number, number][],
): Set<string> {
  const deleted = new Set<string>()
  if (!cutRanges.length) return deleted
  for (const w of words) {
    for (const [a, b] of cutRanges) {
      const lo = Math.min(a, b)
      const hi = Math.max(a, b)
      if (w.t1Ms > lo && w.t0Ms < hi) {
        deleted.add(w.id)
        break
      }
    }
  }
  return deleted
}

export function documentFromClipEdits(words: EditorWord[], edits: ClipEditsV2) {
  const deleted = deletedWordIdsFromCutRanges(words, edits.cutRanges ?? [])
  return buildDocumentFromDeletes(words, deleted)
}
