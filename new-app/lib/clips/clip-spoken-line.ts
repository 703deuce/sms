import { wordsInRange, type SourceWord } from '@/lib/clips/source-words'
import { clipWordSurfaceText } from '@/lib/clips/script-editor/enrich-transcript'

/** First spoken line inside a clip window (text triage under the title). */
export function clipSpokenFirstLine(
  words: SourceWord[],
  startMs: number,
  endMs: number,
  maxChars = 140,
): string | null {
  const slice = wordsInRange(words, startMs, endMs)
  if (!slice.length) return null
  const parts: string[] = []
  for (const w of slice) {
    const t = clipWordSurfaceText(w as SourceWord & Record<string, unknown>).trim()
    if (!t) continue
    parts.push(t)
    const line = parts.join(' ')
    if (line.length >= maxChars || /[.!?]["')\]]*$/.test(t)) break
  }
  const line = parts.join(' ').trim()
  if (!line) return null
  return line.length <= maxChars ? line : `${line.slice(0, maxChars - 1)}…`
}
