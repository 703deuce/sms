import type { ClipWord } from '@/lib/clips/edits'
import { wordKey } from '@/lib/clips/edits'

const CAPTION_TIME_EPS = 0.035

export function activeCaptionWordIndex(words: ClipWord[], currentTimeSec: number): number {
  if (!words.length) return -1
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (currentTimeSec >= w.s - CAPTION_TIME_EPS && currentTimeSec < w.e + CAPTION_TIME_EPS) return i
  }
  return -1
}

export function captionEmojiForWord(
  w: ClipWord,
  globalIdx: number,
  emojiByWord: Record<string, string>,
): string | undefined {
  const candidates = [wordKey(w), w.i, w.idx, globalIdx]
  for (const key of candidates) {
    if (key === undefined) continue
    const hit = emojiByWord[String(key)]
    if (hit) return hit
  }
  return undefined
}
