import { createHash } from 'crypto'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { findMatches, replacementFixes } from '@/lib/clips/editor/find-replace'
import type { VocabEntry } from '@/lib/clips/clip-export-user-types'

export function vocabularyFingerprint(vocab: VocabEntry[]): string {
  return createHash('sha1').update(JSON.stringify(vocab)).digest('hex')
}

/** Collect batch fixes for entries that do not already have a word fix. */
export function vocabularyBatchFixes(
  words: SourceWord[],
  edits: ClipEditsV2,
  vocabulary: VocabEntry[],
): { fixes: Record<string, string>; meta: Record<string, { s: number; w: string }>; count: number } {
  const fixes: Record<string, string> = {}
  const meta: Record<string, { s: number; w: string }> = {}
  let count = 0
  for (const entry of vocabulary) {
    const matches = findMatches(words, edits, entry.from, { wholeWord: true, caseSensitive: false })
    for (const match of matches) {
      for (const idx of match.wordIdx) {
        if (edits.wordFixes[String(idx)] !== undefined) continue
      }
      const rep = replacementFixes(words, match, entry.to)
      Object.assign(fixes, rep.fixes)
      Object.assign(meta, rep.meta)
      count += 1
    }
  }
  return { fixes, meta, count }
}

export function shouldApplyVocabulary(
  vocabAutoApply: boolean | undefined,
  vocabApplied: string | undefined,
  fp: string,
): boolean {
  if (vocabAutoApply === false) return false
  return vocabApplied !== fp
}
