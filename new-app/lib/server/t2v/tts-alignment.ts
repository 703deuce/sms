import type { TtsAlignment } from '@/lib/server/ai/elevenlabs-tts'
import { T2V_WORD_BLOCK } from '@/lib/t2v/types'

export type TranscriptWord = { w: string; s: number; e: number; i: number; spk: number }

/** ElevenLabs character alignment → transcript words (matches worker tts_alignment.words_from_alignment). */
export function wordsFromAlignment(
  alignment: TtsAlignment,
  opts: { offsetS: number; sceneSlot: number; spk?: number },
): TranscriptWord[] {
  const chars = alignment.characters ?? []
  const starts = alignment.character_start_times_seconds ?? []
  const ends = alignment.character_end_times_seconds ?? []
  const spk = opts.spk ?? 0
  const raw: Array<{ w: string; s: number; e: number }> = []
  let buf = ''
  let wStart: number | null = null
  let wEnd: number | null = null
  for (let idx = 0; idx < chars.length; idx++) {
    const ch = chars[idx] ?? ''
    const s = starts[idx] ?? 0
    const e = ends[idx] ?? s
    if (/\s/.test(ch)) {
      if (buf) raw.push({ w: buf, s: wStart ?? s, e: wEnd ?? e })
      buf = ''
      wStart = null
      wEnd = null
      continue
    }
    if (!buf) wStart = s
    buf += ch
    wEnd = e
  }
  if (buf) raw.push({ w: buf, s: wStart ?? 0, e: wEnd ?? 0 })
  return raw.map((wd, k) => ({
    w: wd.w,
    s: round3(wd.s + opts.offsetS),
    e: round3(wd.e + opts.offsetS),
    i: opts.sceneSlot * T2V_WORD_BLOCK + k,
    spk,
  }))
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000
}

export function durationMsFromAlignment(alignment: TtsAlignment): number {
  const ends = alignment.character_end_times_seconds ?? []
  if (!ends.length) return 0
  return Math.ceil(Math.max(...ends) * 1000)
}
