/**
 * Q3.2: snap clip picks to sentence edges (mirrors worker picker/snap_bounds intent for the editor).
 * Start = first word after sentence end or gap >300 ms; end = sentence-final word + 250 ms pad;
 * stays within ±3 s of the candidate and never splits a word.
 */
import type { ClipWord } from '@/lib/clips/edits'
import { clipWordSurfaceText } from '@/lib/clips/script-editor/enrich-transcript'

export type SnapWord = { s: number; e: number; w: string; i?: number }

const SNAP_WINDOW_MS = 3000
const GAP_START_MS = 300
const END_PAD_MS = 250
const SENTENCE_GAP_MS = 350

export function clipWordsToSnapWords(raw: readonly ClipWord[]): SnapWord[] {
  return raw.map((w, pos) => ({
    s: w.s,
    e: w.e,
    w: clipWordSurfaceText(w as ClipWord & Record<string, unknown>),
    i: w.i ?? w.idx ?? pos,
  }))
}

export type SentenceSpan = { startMs: number; endMs: number; wordStart: number; wordEnd: number }

export function buildSentenceSpans(words: readonly SnapWord[], rangeStartMs: number, rangeEndMs: number): SentenceSpan[] {
  const slice = words.filter((w) => w.e * 1000 >= rangeStartMs && w.s * 1000 <= rangeEndMs)
  if (!slice.length) return []
  const out: SentenceSpan[] = []
  let buf: SnapWord[] = []
  let bufStartIdx = 0
  const flush = (endIdx: number) => {
    if (!buf.length) return
    out.push({
      startMs: Math.round(buf[0]!.s * 1000),
      endMs: Math.round(buf[buf.length - 1]!.e * 1000),
      wordStart: bufStartIdx,
      wordEnd: endIdx,
    })
    bufStartIdx = endIdx + 1
    buf = []
  }
  for (let i = 0; i < slice.length; i++) {
    const w = slice[i]!
    const prev = i > 0 ? slice[i - 1]! : null
    const gapMs = prev ? (w.s - prev.e) * 1000 : 0
    const prevEndsSentence = prev ? /[.?!]["')\]]*$/.test(prev.w.trim()) : false
    if (buf.length && (gapMs > SENTENCE_GAP_MS || prevEndsSentence)) flush(i - 1)
    buf.push(w)
  }
  if (buf.length) flush(slice.length - 1)
  return out
}

function wordIndexAtMs(words: readonly SnapWord[], ms: number, edge: 'start' | 'end'): number {
  const t = ms / 1000
  if (edge === 'start') {
    for (let i = 0; i < words.length; i++) {
      if (words[i]!.e >= t) return i
    }
    return Math.max(0, words.length - 1)
  }
  for (let i = words.length - 1; i >= 0; i--) {
    if (words[i]!.s <= t) return i
  }
  return 0
}

function sentenceForMs(sentences: SentenceSpan[], ms: number): SentenceSpan | null {
  for (const s of sentences) {
    if (s.startMs <= ms && ms <= s.endMs) return s
  }
  let best: SentenceSpan | null = null
  let bestD = 1e9
  for (const s of sentences) {
    const d = Math.min(Math.abs(ms - s.startMs), Math.abs(ms - s.endMs))
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return best
}

function clampWindow(candidate: number, pick: number): number {
  const lo = pick - SNAP_WINDOW_MS
  const hi = pick + SNAP_WINDOW_MS
  return Math.max(lo, Math.min(hi, candidate))
}

/** Snap `{ startMs, endMs }` to sentence edges; returns input when words are missing. */
export function snapClipBoundsMs(
  pick: { startMs: number; endMs: number },
  words: readonly SnapWord[],
  rangeStartMs: number,
  rangeEndMs: number,
): { startMs: number; endMs: number } {
  if (!words.length || pick.endMs <= pick.startMs) return pick
  const sentences = buildSentenceSpans(words, rangeStartMs, rangeEndMs)
  let startMs = pick.startMs
  let endMs = pick.endMs

  const sSent = sentenceForMs(sentences, startMs)
  if (sSent) {
    const wi = wordIndexAtMs(words, startMs, 'start')
    const prev = wi > 0 ? words[wi - 1]! : null
    const gapBefore = prev ? (words[wi]!.s - prev.e) * 1000 : GAP_START_MS + 1
    if (gapBefore > GAP_START_MS) startMs = Math.round(words[wi]!.s * 1000)
    else startMs = sSent.startMs
  } else {
    const wi = wordIndexAtMs(words, startMs, 'start')
    startMs = Math.round(words[wi]!.s * 1000)
  }

  const eSent = sentenceForMs(sentences, endMs)
  if (eSent) {
    endMs = Math.min(rangeEndMs, eSent.endMs + END_PAD_MS)
  } else {
    const we = wordIndexAtMs(words, endMs, 'end')
    endMs = Math.min(rangeEndMs, Math.round(words[we]!.e * 1000) + END_PAD_MS)
  }

  startMs = clampWindow(startMs, pick.startMs)
  endMs = clampWindow(endMs, pick.endMs)
  startMs = Math.max(rangeStartMs, startMs)
  endMs = Math.min(rangeEndMs, Math.max(endMs, startMs + 1000))

  if (endMs <= startMs) return pick
  return { startMs, endMs }
}
