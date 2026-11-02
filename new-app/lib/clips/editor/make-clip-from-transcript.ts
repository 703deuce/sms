import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs } from '@/lib/clips/source-words'
import { clipWordsToSnapWords, snapClipBoundsMs } from '@/lib/clips/editor/snap-clip-bounds'

/** Q5: snap transcript selection to sentences before derive (mirrors server derive). */
export function snapTranscriptSelectionMs(
  selStart: number,
  selEnd: number,
  words: readonly SourceWord[],
  trimIn: number,
  trimOut: number,
): { trimIn: number; trimOut: number; title: string } {
  const a = Math.min(selStart, selEnd)
  const b = Math.max(selStart, selEnd)
  const snapWords = clipWordsToSnapWords(
    words.map((w, i) => ({
      w: w.word,
      s: w.s,
      e: w.e,
      i: w.i ?? i,
    })),
  )
  const snapped = snapClipBoundsMs({ startMs: a, endMs: b }, snapWords, trimIn, trimOut)
  const inRange = words.filter((w) => {
    const { midMs } = wordSourceMs(w)
    return midMs >= snapped.startMs && midMs <= snapped.endMs
  })
  const title = inRange
    .map((w) => w.word)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return { trimIn: snapped.startMs, trimOut: snapped.endMs, title: title || 'New clip' }
}
