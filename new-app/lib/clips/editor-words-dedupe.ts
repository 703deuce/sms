import type { SourceWord } from '@/lib/clips/source-words'

function normalizeWordText(w: string): string {
  return w
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim()
}

/** Drop adjacent duplicates (same normalized text, starts within `withinMs`). */
export function dedupeAdjacentEditorWords(words: SourceWord[], withinMs = 60): SourceWord[] {
  if (words.length < 2) return words
  const out: SourceWord[] = []
  for (const word of words) {
    const prev = out[out.length - 1]
    if (prev) {
      const dt = Math.abs(word.s * 1000 - prev.s * 1000)
      if (dt <= withinMs && normalizeWordText(prev.w) === normalizeWordText(word.w)) continue
    }
    out.push(word)
  }
  return out
}
