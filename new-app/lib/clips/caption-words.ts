import { keepSegments, remapTime, type ClipEditsV2, type CutRange } from '@/lib/clips/edits'

function remapTimeEnd(tMs: number, segs: [number, number][]): number | null {
  let acc = 0
  for (const [a, b] of segs) {
    if (a < tMs && tMs <= b) return acc + (tMs - a)
    if (a <= tMs && tMs < b) return acc + (tMs - a)
    acc += b - a
  }
  return null
}

export type CaptionWord = {
  i: number
  text: string
  s_ms: number
  e_ms: number
  spk?: number
}

export type CaptionSourceWord = {
  i: number
  w: string
  s: number
  e: number
  spk?: number
}

export function wordMidMs(w: { s: number; e: number }): number {
  return ((w.s + w.e) / 2) * 1000
}

export function isWordCutByRanges(w: { s: number; e: number }, cutRanges: CutRange[]): boolean {
  const mid = wordMidMs(w)
  return cutRanges.some(([a, b]) => mid >= a && mid < b)
}

/** Output-timeline caption words; shared contract with worker/clips_worker/caption_words.py */
export function buildCaptionWords(words: CaptionSourceWord[], edits: ClipEditsV2): CaptionWord[] {
  const cutRanges = edits.cutRanges
  const segs = keepSegments(edits.trim.in, edits.trim.out, cutRanges)
  const out: CaptionWord[] = []
  for (const w of words) {
    if (isWordCutByRanges(w, cutRanges)) continue
    const sMs = w.s * 1000
    const eMs = w.e * 1000
    const mid = (sMs + eMs) / 2
    const seg = segs.find(([a, b]) => a <= mid && mid < b)
    if (!seg) continue
    const [a, b] = seg
    const clampStart = Math.max(sMs, a)
    const clampEnd = Math.min(eMs, b)
    if (clampEnd - clampStart < 20) continue
    const outS = remapTime(clampStart, segs)
    const outE = remapTimeEnd(clampEnd, segs)
    if (outS === null || outE === null || outE <= outS) continue
    const rawText = edits.wordFixes[String(w.i)] ?? w.w
    const text = typeof rawText === 'string' ? rawText : String(rawText ?? '')
    if (!text.trim()) continue
    out.push({
      i: w.i,
      text,
      s_ms: outS,
      e_ms: outE,
      spk: w.spk,
    })
  }
  return out
}

export function captionWordsToClipWords(caption: CaptionWord[]): { w: string; s: number; e: number; idx?: number }[] {
  return caption.map((c) => ({
    w: typeof c.text === 'string' ? c.text : String(c.text ?? ''),
    s: c.s_ms / 1000,
    e: c.e_ms / 1000,
    idx: c.i,
  }))
}
