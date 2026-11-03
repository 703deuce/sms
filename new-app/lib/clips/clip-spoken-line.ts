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
  // FIX1 (H3): skip a leading sentence tail (< 4 words ending in .!?) from the previous sentence.
  let startIdx = 0
  for (let i = 0; i < Math.min(slice.length, 4); i++) {
    const t = clipWordSurfaceText(slice[i] as SourceWord & Record<string, unknown>).trim()
    if (/[.!?]["')\]]*$/.test(t)) {
      startIdx = i + 1
      break
    }
  }
  const parts: string[] = []
  for (const w of slice.slice(startIdx)) {
    const t = clipWordSurfaceText(w as SourceWord & Record<string, unknown>).trim()
    if (!t) continue
    parts.push(t)
    const line = parts.join(' ')
    if (line.length >= maxChars || (parts.length >= 4 && /[.!?]["')\]]*$/.test(t))) break
  }
  const line = parts.join(' ').trim()
  if (!line || parts.length < 3) return null
  return line.length <= maxChars ? line : `${line.slice(0, maxChars - 1)}…`
}
