import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs, wordsInRange } from '@/lib/clips/source-words'

/** Words on the active trim timeline (excludes distant project-transcript neighbors). */
export function sourceWordsForClipEditing(
  words: SourceWord[],
  edits: Pick<ClipEditsV2, 'trim'>,
  clipBounds?: { clipStartMs: number; clipEndMs: number },
): SourceWord[] {
  const { in: trimIn, out: trimOut } = edits.trim
  const inTrim = words.filter((w) => {
    const { startMs, endMs } = wordSourceMs(w)
    return endMs > trimIn + 15 && startMs < trimOut - 15
  })
  // A one-word clip is still a complete clip. Falling back to every project
  // word made one-second clips display the entire struck-through transcript.
  if (inTrim.length > 0) return inTrim
  if (clipBounds) {
    const ranged = wordsInRange(words, clipBounds.clipStartMs, clipBounds.clipEndMs)
    if (ranged.length > 0) return ranged
  }
  // No words in this trim must not resurrect the full project transcript.
  return []
}

export function maxPlausibleGapMsForTrim(trim: { in: number; out: number }): number {
  const span = Math.max(0, trim.out - trim.in)
  return Math.min(15_000, Math.max(2_500, Math.round(span * 0.55)))
}
