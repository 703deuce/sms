import type { CaptionWord } from '@/lib/clips/caption-words'
import type { SourceWord } from '@/lib/clips/source-words'

export type DubWordRow = { w: string; s_ms: number; e_ms: number; i?: number; spk?: string }

/** Dub SRT words are already on the clip output timeline (ms). */
export function dubWordsToCaptionWords(rows: DubWordRow[]): CaptionWord[] {
  return rows.map((w, idx) => ({
    i: w.i ?? idx,
    text: w.w,
    s_ms: w.s_ms,
    e_ms: w.e_ms,
    spk: w.spk === 'B' ? 1 : 0,
  }))
}

export function dubWordsToSourceWords(rows: DubWordRow[]): SourceWord[] {
  return rows.map((w, idx) => ({
    w: w.w,
    s: w.s_ms / 1000,
    e: w.e_ms / 1000,
    i: w.i ?? idx,
    spk: w.spk === 'B' ? 1 : 0,
  }))
}
