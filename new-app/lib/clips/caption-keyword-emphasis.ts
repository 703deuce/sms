import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
const FILLER_ONLY_RE = /^(um|uh|erm|hmm|mm|mhm)$/i

const STOP = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'so',
  'to',
  'of',
  'in',
  'on',
  'at',
  'is',
  'it',
  'that',
  'this',
  'you',
  'we',
  'they',
  'i',
  'my',
  'your',
  'for',
  'with',
  'as',
  'be',
  'are',
  'was',
  'were',
])

const STRONG = /\b(never|always|secret|why|how|best|worst|crazy|insane|million|percent|%|\d+)\b/i

function scoreKeyword(text: string): number {
  const t = text.replace(/[^\w'%$]/g, '')
  if (!t || t.length < 2) return -1
  if (FILLER_ONLY_RE.test(t)) return -1
  if (STOP.has(t.toLowerCase())) return 0
  let s = Math.min(t.length, 12) / 4
  if (/^\d/.test(t) || STRONG.test(t)) s += 3
  if (/^[A-Z]/.test(text) && text.length > 2) s += 1.5
  if (t.length >= 6) s += 0.5
  return s
}

function sentenceBoundaries(words: SourceWord[]): number[] {
  const ends: number[] = [0]
  for (let i = 0; i < words.length; i++) {
    const w = words[i].w
    if (/[.!?]["']?$/.test(w.trim())) ends.push(i + 1)
  }
  if (ends[ends.length - 1] !== words.length) ends.push(words.length)
  return ends
}

/** One AI keyword per sentence; cap 3–4 emphasis indexes per caption line chunk. */
export function autoCaptionEmphasisIndexes(
  words: SourceWord[],
  edits: ClipEditsV2,
): number[] {
  if (!words.length) return []
  const wpl = Math.min(3, Math.max(1, edits.captions?.wordsPerLine ?? 3))
  const bounds = sentenceBoundaries(words)
  const picked: number[] = []

  for (let si = 0; si < bounds.length - 1; si++) {
    const start = bounds[si]
    const end = bounds[si + 1]
    const slice = words.slice(start, end)
    if (!slice.length) continue
    let best: SourceWord | null = null
    let bestScore = 0
    for (const w of slice) {
      const sc = scoreKeyword(w.w)
      if (sc > bestScore) {
        bestScore = sc
        best = w
      }
    }
    if (best && bestScore >= 1.5) picked.push(best.i)
  }

  const lineCapped: number[] = []
  for (let i = 0; i < words.length; i += wpl) {
    const line = words.slice(i, i + wpl * 2)
    const inLine = picked.filter((idx) => line.some((w) => w.i === idx))
    lineCapped.push(...inLine.slice(0, 4))
  }
  return [...new Set(lineCapped)]
}
