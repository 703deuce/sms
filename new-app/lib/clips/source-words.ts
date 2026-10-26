import type { ClipWord } from '@/lib/clips/edits'

export type SourceWord = ClipWord & { idx: number }

export function loadSourceWords(raw: ClipWord[]): SourceWord[] {
  return raw.map((w, idx) => ({ ...w, idx }))
}

/** Words overlapping [startMs, endMs] on the source timeline (seconds in w.s/w.e). */
export function wordsInRange(words: SourceWord[], startMs: number, endMs: number): SourceWord[] {
  return words.filter((w) => w.e * 1000 > startMs && w.s * 1000 < endMs)
}

export function wordSourceMs(w: ClipWord): { startMs: number; endMs: number; midMs: number } {
  const startMs = w.s * 1000
  const endMs = w.e * 1000
  return { startMs, endMs, midMs: (startMs + endMs) / 2 }
}
