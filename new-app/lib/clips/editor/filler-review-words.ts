import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { sourceWordsForClipEditing } from '@/lib/clips/editor/clip-editor-word-scope'
import { enrichTranscriptWords } from '@/lib/clips/script-editor/enrich-transcript'
import { listFillerHits } from '@/lib/clips/script-editor/filler-hits'
import { toEditorWords, type EditorWord } from '@/lib/clips/script-editor/to-editor-words'

/** Map clip transcript words to script-editor filler hits (reuse enrich + stable ids). */
export function editorWordsForClipFillerReview(
  clipId: string,
  words: SourceWord[],
  edits?: Pick<ClipEditsV2, 'trim'>,
  clipBounds?: { clipStartMs: number; clipEndMs: number },
): EditorWord[] {
  const scoped = edits ? sourceWordsForClipEditing(words, edits, clipBounds) : words
  const enriched = enrichTranscriptWords(scoped)
  return toEditorWords(`clip:${clipId}`, enriched)
}

export function editorWordDeletedByCuts(word: EditorWord, cutRanges: [number, number][]): boolean {
  return cutRanges.some(([a, b]) => word.t0Ms < b && word.t1Ms > a)
}

/** Count lexicon/repeat fillers in trim (used for clip filler review; 0 may be legit on cleaned clips). */
export function countClipFillerHitsInTrim(
  clipId: string,
  words: SourceWord[],
  edits: Pick<ClipEditsV2, 'trim' | 'cutRanges'>,
  clipBounds?: { clipStartMs: number; clipEndMs: number },
): number {
  const ordered = editorWordsForClipFillerReview(clipId, words, edits, clipBounds)
  const deleted = deletedEditorWordIds(ordered, edits.cutRanges ?? [])
  return listFillerHits(ordered, deleted, { avoidHarshCuts: false }).length
}

export function deletedEditorWordIds(words: EditorWord[], cutRanges: [number, number][]): Set<string> {
  const set = new Set<string>()
  for (const w of words) {
    if (editorWordDeletedByCuts(w, cutRanges)) set.add(w.id)
  }
  return set
}
