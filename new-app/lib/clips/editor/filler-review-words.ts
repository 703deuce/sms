import type { SourceWord } from '@/lib/clips/source-words'
import { enrichTranscriptWords } from '@/lib/clips/script-editor/enrich-transcript'
import { toEditorWords, type EditorWord } from '@/lib/clips/script-editor/to-editor-words'

/** Map clip transcript words to script-editor filler hits (reuse enrich + stable ids). */
export function editorWordsForClipFillerReview(clipId: string, words: SourceWord[]): EditorWord[] {
  const enriched = enrichTranscriptWords(words)
  return toEditorWords(`clip:${clipId}`, enriched)
}

export function editorWordDeletedByCuts(word: EditorWord, cutRanges: [number, number][]): boolean {
  return cutRanges.some(([a, b]) => word.t0Ms < b && word.t1Ms > a)
}

export function deletedEditorWordIds(words: EditorWord[], cutRanges: [number, number][]): Set<string> {
  const set = new Set<string>()
  for (const w of words) {
    if (editorWordDeletedByCuts(w, cutRanges)) set.add(w.id)
  }
  return set
}
