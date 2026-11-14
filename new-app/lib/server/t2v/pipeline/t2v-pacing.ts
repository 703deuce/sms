import type { T2vPipelineStyle } from '@/lib/t2v/pipeline/t2v-types'

/**
 * Editorial pacing for Prompt-to-Video (pure; no I/O).
 *
 * The planner tags every sentence with a beat and offers 2-3 verbatim pieces at natural pauses for longer
 * sentences. This module decides, per video, which sentences split into several shots and which short
 * sentences share one shot:
 * - beats set the shot-length range: establishing / aerial / emotional hold long (6-10 s), lists, steps
 *   and action cut quickly (2-4 s), details sit in between;
 * - style sets the base tempo (documentary slowest, social punchiest);
 * - a per-video seed varies tempo and the split/merge choices, so two videos never share one rhythm.
 * Pieces of one sentence share one narration clip (one TTS call, natural prosody); the worker cuts between
 * them on the pause before the piece's first word (ElevenLabs word timings), never mid-word.
 */
export const T2V_BEATS = ['establishing', 'aerial', 'emotional', 'detail', 'step', 'list', 'action', 'transition'] as const
export type T2vBeat = (typeof T2V_BEATS)[number]

export const BEAT_RANGE_S: Record<T2vBeat, [number, number]> = {
  establishing: [6, 10],
  aerial: [6, 10],
  emotional: [6, 9],
  detail: [3.5, 6],
  transition: [3.5, 6],
  step: [2, 4],
  list: [2, 3.5],
  action: [2.5, 4],
}

/** Multiplier on beat ranges: < 1 = punchier. */
export const STYLE_TEMPO: Record<T2vPipelineStyle, number> = {
  documentary: 1.1,
  educational: 1.0,
  explainer: 0.95,
  marketing: 0.85,
  social: 0.7,
}

const WORDS_PER_S = 2.45
const MIN_PIECE_WORDS = 4
const MAX_PIECES = 3
const QUICK: ReadonlySet<T2vBeat> = new Set(['step', 'list', 'action', 'detail'])
const LONG: ReadonlySet<T2vBeat> = new Set(['establishing', 'aerial', 'emotional'])

export type T2vPiece = { text: string; intent: string; queries: string[]; subject: string }
export type T2vPacingRow = {
  segmentId: string
  narration: string
  beat: T2vBeat
  intent: string
  queries: string[]
  subject: string
  onScreenText?: string
  /** Verbatim contiguous pieces offered by the planner (validated), each with its own visual. */
  pieces?: T2vPiece[]
}
export type T2vPacedShot = {
  segmentId: string
  /** Shots with the same voiceGroup share one narration clip; later ones are in-scene cuts. */
  voiceGroup: string
  /** Index of this shot's first word inside the voice group's narration. */
  wordOffset: number
  narration: string
  /** The whole voice-group narration (what the viewer hears around this shot). */
  sentence: string
  beat: T2vBeat
  intent: string
  queries: string[]
  subject: string
  needS: number
  onScreenText?: string
}

export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean)
const norm = (t: string) =>
  words(t.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, ' '))
    .join(' ')
    .trim()

/** Pieces must be the sentence, word for word, in order, each long enough to hold a shot. */
export function validPieces(sentence: string, pieces: T2vPiece[] | undefined): T2vPiece[] | undefined {
  if (!pieces || pieces.length < 2 || pieces.length > MAX_PIECES) return undefined
  if (pieces.some((p) => words(p.text).length < MIN_PIECE_WORDS)) return undefined
  if (norm(pieces.map((p) => p.text).join(' ')) !== norm(sentence)) return undefined
  return pieces
}

export function estimateS(text: string): number {
  return words(text).length / WORDS_PER_S
}

/** Merge adjacent pieces until there are k (balanced by word count). */
function toK(pieces: T2vPiece[], k: number): T2vPiece[] {
  const out = pieces.map((p) => ({ ...p, queries: [...p.queries] }))
  while (out.length > k) {
    let best = 0
    let bestLen = Infinity
    for (let i = 0; i < out.length - 1; i++) {
      const len = words(out[i]!.text).length + words(out[i + 1]!.text).length
      if (len < bestLen) {
        bestLen = len
        best = i
      }
    }
    const a = out[best]!
    const b = out[best + 1]!
    out.splice(best, 2, { text: `${a.text} ${b.text}`, intent: a.intent, subject: a.subject, queries: [...new Set([...a.queries, ...b.queries])].slice(0, 3) })
  }
  return out
}

export function planPacing(rows: T2vPacingRow[], opts: { style: T2vPipelineStyle; seed: string }): T2vPacedShot[] {
  const rnd = seededRandom(opts.seed)
  // Per-video tempo: the style's base +-15%, so cut patterns differ between videos.
  const tempo = STYLE_TEMPO[opts.style] * (0.85 + 0.3 * rnd())
  const range = (b: T2vBeat): [number, number] => {
    const [lo, hi] = BEAT_RANGE_S[b] ?? BEAT_RANGE_S.detail
    return [lo * tempo, hi * tempo]
  }

  // 1) Short neighbouring sentences in quick beats may share one shot (same segment, fits the range).
  type Group = { rows: T2vPacingRow[] }
  const groups: Group[] = []
  for (const row of rows) {
    const g = groups[groups.length - 1]
    if (g && g.rows.length < 2 && g.rows[0]!.segmentId === row.segmentId && !row.onScreenText) {
      const first = g.rows[0]!
      const both = estimateS(first.narration) + estimateS(row.narration)
      const [, hi] = range(first.beat)
      const short = estimateS(first.narration) < range(first.beat)[0] && estimateS(row.narration) < 3.2
      // Quick beats: two short lines can ride one shot. Long beats: two lines can make one long hold.
      const quickMerge = short && QUICK.has(first.beat) && both <= Math.min(hi * 1.2, 7)
      const holdMerge = LONG.has(first.beat) && LONG.has(row.beat) && both >= range(first.beat)[0] && both <= Math.min(hi, 10)
      if ((quickMerge && rnd() < 0.7) || (holdMerge && rnd() < 0.5)) {
        g.rows.push(row)
        continue
      }
    }
    groups.push({ rows: [row] })
  }

  // 2) Long sentences split into 2-3 shots at the planner's natural pauses when the beat wants quicker cuts.
  const out: T2vPacedShot[] = []
  groups.forEach((g, gi) => {
    const voiceGroup = `vg_${gi}`
    const first = g.rows[0]!
    const narration = g.rows.map((r) => r.narration).join(' ')
    if (g.rows.length > 1) {
      out.push({
        segmentId: first.segmentId,
        voiceGroup,
        wordOffset: 0,
        narration,
        sentence: narration,
        beat: first.beat,
        intent: first.intent,
        queries: [...new Set(g.rows.flatMap((r) => r.queries))].slice(0, 4),
        subject: first.subject,
        needS: Math.round((estimateS(narration) + 0.4) * 10) / 10,
        ...(first.onScreenText ? { onScreenText: first.onScreenText } : {}),
      })
      return
    }
    const d = estimateS(narration)
    const [lo, hi] = range(first.beat)
    const target = lo + (hi - lo) * rnd()
    const pieces = first.pieces
    let k = 1
    if (pieces && pieces.length >= 2 && d > target * 1.3) {
      k = Math.min(pieces.length, MAX_PIECES, Math.max(2, Math.round(d / target)))
    }
    if (k === 1) {
      out.push({
        segmentId: first.segmentId,
        voiceGroup,
        wordOffset: 0,
        narration,
        sentence: narration,
        beat: first.beat,
        intent: first.intent,
        queries: first.queries,
        subject: first.subject,
        needS: Math.round((d + 0.4) * 10) / 10,
        ...(first.onScreenText ? { onScreenText: first.onScreenText } : {}),
      })
      return
    }
    let offset = 0
    toK(pieces!, k).forEach((p, pi, arr) => {
      out.push({
        segmentId: first.segmentId,
        voiceGroup,
        wordOffset: offset,
        narration: p.text,
        sentence: narration,
        beat: first.beat,
        intent: p.intent || first.intent,
        queries: p.queries.length ? p.queries : first.queries,
        subject: p.subject || first.subject,
        needS: Math.round((estimateS(p.text) + (pi === arr.length - 1 ? 0.4 : 0.1)) * 10) / 10,
        ...(pi === 0 && first.onScreenText ? { onScreenText: first.onScreenText } : {}),
      })
      offset += words(p.text).length
    })
  })
  return out
}

/** Coefficient of variation and the longest run of near-equal consecutive shot lengths. */
export function pacingStats(lengthsS: number[], nearPct = 0.15): { cv: number; longestEqualRun: number; mean: number } {
  const n = lengthsS.length
  if (!n) return { cv: 0, longestEqualRun: 0, mean: 0 }
  const mean = lengthsS.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(lengthsS.reduce((a, b) => a + (b - mean) ** 2, 0) / n)
  let run = 1
  let longest = 1
  for (let i = 1; i < n; i++) {
    const a = lengthsS[i - 1]!
    const b = lengthsS[i]!
    run = Math.abs(a - b) / Math.max(a, b) <= nearPct ? run + 1 : 1
    longest = Math.max(longest, run)
  }
  return { cv: mean ? sd / mean : 0, longestEqualRun: longest, mean }
}

/** Pacing QA thresholds: varied enough (CV) and no metronomic stretch (3+ near-equal shots in a row). */
export const PACING_MIN_CV = 0.3
export const PACING_MAX_EQUAL_RUN = 3
