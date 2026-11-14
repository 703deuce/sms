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

const BRIEF_STOP = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'then', 'while', 'as', 'so', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'into', 'from', 'until', 'your', 'you', 'it', 'its', 'their', 'this', 'that', 'those', 'these', 'is', 'are', 'be', 'can', 'will', 'feels', 'feel', 'little', 'way', 'more', 'less', 'some', 'any', 'every', 'when', 'where', 'before', 'after'])
const contentWords = (t: string) => words(t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ')).filter((w) => w.length > 2 && !BRIEF_STOP.has(w))
const stemOf = (w: string) => (w.length > 5 ? w.slice(0, 5) : w.replace(/s$/, ''))

/**
 * Visual brief for each piece of a sentence split WITHOUT the planner's per-piece briefs (auto pieces, forced
 * pacing split). The piece that matches the sentence's subject keeps the sentence brief; every other piece gets
 * one from its OWN words (sleep run 4: "and adjust bedding until the space feels restful" inherited "person
 * closing bedroom curtains", so every bedding clip failed the subject rule and the line fell to a 1/10 pick).
 */
export function pieceBriefs(
  parent: { intent: string; subject: string; queries: string[] },
  texts: string[],
): Array<{ intent: string; subject: string; queries: string[] }> {
  const parentWords = new Set(contentWords(`${parent.subject} ${parent.queries.join(' ')}`).map(stemOf))
  const hits = texts.map((t) => contentWords(t).filter((w) => parentWords.has(stemOf(w))).length)
  const owner = hits.indexOf(Math.max(...hits))
  return texts.map((t, i) => {
    if (i === owner) return { intent: parent.intent, subject: parent.subject, queries: parent.queries }
    const own = contentWords(t)
    if (!own.length) return { intent: parent.intent, subject: parent.subject, queries: parent.queries }
    const ownStems = new Set(own.map(stemOf))
    const related = parent.queries.filter((q) => contentWords(q).some((w) => ownStems.has(stemOf(w))))
    const core = own.slice(0, 2).join(' ')
    const queries = [...new Set([core, ...related, ...parent.queries])].slice(0, 3)
    return { intent: `Stock B-roll that shows: ${t.trim()}`, subject: own.slice(0, 5).join(' '), queries }
  })
}

const PAUSE_BEFORE = new Set(['and', 'then', 'while', 'but', 'as', 'where', 'which', 'before', 'after', 'until', 'so', 'when', 'from', 'into', 'with'])

/**
 * Natural pauses when the planner offered no pieces: after , ; : - and before linking words.
 * Each piece >= MIN_PIECE_WORDS; up to 3 pieces, cut points nearest the even split. Pieces reuse the
 * row's visual brief (each still gets its own distinct verified clip downstream).
 */
export function autoPieces(row: T2vPacingRow, maxK = MAX_PIECES): T2vPiece[] | undefined {
  const w = words(row.narration)
  const cands: number[] = []
  for (let i = MIN_PIECE_WORDS; i <= w.length - MIN_PIECE_WORDS; i++) {
    if (/[,;:\u2014-]$/.test(w[i - 1]!) || PAUSE_BEFORE.has(w[i]!.toLowerCase())) cands.push(i)
  }
  if (!cands.length) return undefined
  const k = Math.min(maxK, Math.floor(w.length / MIN_PIECE_WORDS), cands.length + 1)
  if (k < 2) return undefined
  const cuts: number[] = []
  for (let j = 1; j < k; j++) {
    const ideal = (w.length * j) / k
    const pick = cands
      .filter((c) => c > (cuts[cuts.length - 1] ?? 0) + MIN_PIECE_WORDS - 1 && w.length - c >= MIN_PIECE_WORDS * (k - j))
      .sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal))[0]
    if (pick === undefined) break
    cuts.push(pick)
  }
  if (!cuts.length) return undefined
  const bounds = [0, ...cuts, w.length]
  const texts = bounds.slice(0, -1).map((b, i) => w.slice(b, bounds[i + 1]).join(' '))
  const briefs = pieceBriefs(row, texts)
  return texts.map((text, i) => ({ text, ...briefs[i]! }))
}

type PlanKnobs = { holdP: number; splitP: number; detailSplitP: number; quickMergeP: number }

function shotOf(rows: T2vPacingRow[], voiceGroup: string): T2vPacedShot {
  const first = rows[0]!
  const narration = rows.map((r) => r.narration).join(' ')
  return {
    segmentId: first.segmentId,
    voiceGroup,
    wordOffset: 0,
    narration,
    sentence: narration,
    beat: first.beat,
    intent: first.intent,
    queries: rows.length > 1 ? [...new Set(rows.flatMap((r) => r.queries))].slice(0, 4) : first.queries,
    subject: first.subject,
    needS: Math.round((estimateS(narration) + 0.4) * 10) / 10,
  }
}

function planOnce(rows: T2vPacingRow[], tempo: number, rnd: () => number, k: PlanKnobs): T2vPacedShot[] {
  const range = (b: T2vBeat): [number, number] => {
    const [lo, hi] = BEAT_RANGE_S[b] ?? BEAT_RANGE_S.detail
    return [lo * tempo, hi * tempo]
  }
  const out: T2vPacedShot[] = []
  let g = 0
  for (let i = 0; i < rows.length; ) {
    const row = rows[i]!
    const [lo, hi] = range(row.beat)
    const d = estimateS(row.narration)
    // Long beats: merge following (non-quick) lines of the same segment into one real 6-10 s hold.
    if (LONG.has(row.beat) && rnd() < k.holdP) {
      const group = [row]
      let total = d
      const want = lo + (hi - lo) * (0.35 + 0.65 * rnd())
      while (total < want && i + group.length < rows.length) {
        const nx = rows[i + group.length]!
        const nd = estimateS(nx.narration)
        if (nx.segmentId !== row.segmentId || QUICK.has(nx.beat) && nx.beat !== 'detail' || total + nd > Math.min(hi, 9.6)) break
        group.push(nx)
        total += nd
      }
      if (group.length > 1 || d >= lo * 0.9) {
        out.push(shotOf(group, `vg_${g++}`))
        i += group.length
        continue
      }
    }
    // Quick beats: two very short lines may share one shot now and then.
    const nx = rows[i + 1]
    if (nx && QUICK.has(row.beat) && nx.segmentId === row.segmentId && d < 2.6 && estimateS(nx.narration) < 2.6 && rnd() < k.quickMergeP) {
      out.push(shotOf([row, nx], `vg_${g++}`))
      i += 2
      continue
    }
    // Steps, lists, action: cut every 2-4 s at natural pauses. Details/transitions split sometimes.
    const quick = row.beat === 'step' || row.beat === 'list' || row.beat === 'action'
    const pieces = row.pieces ?? autoPieces(row)
    const splitP = quick ? k.splitP : row.beat === 'detail' || row.beat === 'transition' ? k.detailSplitP : 0
    let kk = 1
    if (pieces && pieces.length >= 2 && d >= 3.2 && rnd() < splitP) {
      const target = quick ? lo + (hi - lo) * rnd() : (lo + hi) / 2
      const maxK = Math.min(pieces.length, MAX_PIECES, Math.max(2, Math.floor(d / 1.7)))
      // Usually the beat's target; sometimes one fewer cut, so equal-length triplets don't line up.
      kk = Math.min(maxK, Math.max(2, Math.round(d / Math.max(1.8, target))))
      if (kk > 2 && rnd() < 0.4) kk--
    }
    const vg = `vg_${g++}`
    if (kk === 1) {
      out.push(shotOf([row], vg))
      i++
      continue
    }
    let offset = 0
    toK(pieces!, kk).forEach((p, pi, arr) => {
      out.push({
        segmentId: row.segmentId,
        voiceGroup: vg,
        wordOffset: offset,
        narration: p.text,
        sentence: row.narration,
        beat: row.beat,
        intent: p.intent || row.intent,
        queries: p.queries.length ? p.queries : row.queries,
        subject: p.subject || row.subject,
        needS: Math.round((estimateS(p.text) + (pi === arr.length - 1 ? 0.4 : 0.1)) * 10) / 10,
      })
      offset += words(p.text).length
    })
    i++
  }
  return out
}

/** Undo one split inside a run of 3+ near-equal shots (merge a piece back into its sibling). */
export function repairEqualRuns(shots: T2vPacedShot[]): T2vPacedShot[] {
  const out = shots.map((x) => ({ ...x }))
  const near = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b) <= 0.15
  for (let guard = 0; guard < 12; guard++) {
    let start = -1
    for (let i = 2; i < out.length; i++) {
      if (near(out[i - 2]!.needS, out[i - 1]!.needS) && near(out[i - 1]!.needS, out[i]!.needS)) {
        start = i - 2
        break
      }
    }
    if (start < 0) break
    let merged = false
    for (const j of [start + 1, start, start + 2, start + 3]) {
      const a = out[j]
      const b = out[j + 1]
      if (!a || !b || a.voiceGroup !== b.voiceGroup) continue
      out.splice(j, 2, { ...a, narration: `${a.narration} ${b.narration}`, needS: Math.round((estimateS(`${a.narration} ${b.narration}`) + (b.needS - estimateS(b.narration))) * 10) / 10 })
      merged = true
      break
    }
    if (!merged) break
  }
  return out
}

/** Pacing quality of a plan: passes the render QA bars with a margin. */
function planScore(shots: T2vPacedShot[]): { ok: boolean; score: number } {
  const st = pacingStats(shots.map((s) => s.needS))
  const ok = st.cv >= PACING_MIN_CV + 0.04 && st.longestEqualRun < PACING_MAX_EQUAL_RUN
  return { ok, score: Math.min(st.cv, 0.5) - 0.06 * Math.max(0, st.longestEqualRun - (PACING_MAX_EQUAL_RUN - 1)) }
}

/**
 * Editorial plan: holds for establishing/aerial/emotional beats (merging neighbouring lines), 2-4 s cuts
 * on steps/lists/action, details in between. The plan is re-drawn (seeded, increasingly decisive) until
 * shot lengths vary enough (CV >= 0.34, no 3 near-equal shots in a row) before any footage search.
 */
export function planPacing(rows: T2vPacingRow[], opts: { style: T2vPipelineStyle; seed: string }): T2vPacedShot[] {
  const base = seededRandom(opts.seed)
  // Per-video tempo: the style's base +-15%, so cut patterns differ between videos.
  const tempo = STYLE_TEMPO[opts.style] * (0.85 + 0.3 * base())
  let best: { shots: T2vPacedShot[]; score: number } | null = null
  for (let a = 0; a < 60; a++) {
    const rnd = seededRandom(`${opts.seed}:${a}`)
    const t = Math.min(1, a / 30)
    const knobs: PlanKnobs = { holdP: 0.75 + 0.25 * t, splitP: 0.75 + 0.25 * t, detailSplitP: 0.3 + 0.3 * t, quickMergeP: 0.25 * (1 - t) }
    const shots = repairEqualRuns(planOnce(rows, tempo, rnd, knobs))
    const sc = planScore(shots)
    if (sc.ok) return shots
    if (!best || sc.score > best.score) best = { shots, score: sc.score }
  }
  // No passing plan in 60 draws: force-break every run of 3 near-equal shots (merge or split a neighbour).
  return forceBreakEqualRuns(best!.shots)
}

const nearLen = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b) <= 0.15
const r1 = (x: number) => Math.round(x * 10) / 10

/** Number of positions i where shots i-2, i-1, i are near-equal (0 = no run of 3). */
export function equalTriplets(lengths: number[]): number {
  let n = 0
  for (let i = 2; i < lengths.length; i++) if (nearLen(lengths[i - 2]!, lengths[i - 1]!) && nearLen(lengths[i - 1]!, lengths[i]!)) n++
  return n
}

/** A shot that is one whole sentence (or several whole sentences) on its own voice group. */
function wholeShot(shots: T2vPacedShot[], i: number): boolean {
  const s = shots[i]!
  return s.wordOffset === 0 && norm(s.narration) === norm(s.sentence) && shots[i - 1]?.voiceGroup !== s.voiceGroup && shots[i + 1]?.voiceGroup !== s.voiceGroup
}

/** Candidate fixes for the run starting at `start`: merges of neighbours and 2-way splits of whole shots. */
function fixCandidates(shots: T2vPacedShot[], start: number): T2vPacedShot[][] {
  const out: T2vPacedShot[][] = []
  for (let j = Math.max(0, start - 1); j <= start + 2; j++) {
    const a = shots[j]
    const b = shots[j + 1]
    if (!a || !b || a.segmentId !== b.segmentId) continue
    const sameGroup = a.voiceGroup === b.voiceGroup
    if (!sameGroup && !(wholeShot(shots, j) && wholeShot(shots, j + 1))) continue
    const narration = `${a.narration} ${b.narration}`
    const merged: T2vPacedShot = sameGroup
      ? { ...a, narration, needS: r1(estimateS(narration) + (b.needS - estimateS(b.narration))) }
      : {
          ...a,
          narration,
          sentence: narration,
          queries: [...new Set([...a.queries, ...b.queries])].slice(0, 4),
          needS: r1(estimateS(narration) + 0.4),
        }
    out.push([...shots.slice(0, j), merged, ...shots.slice(j + 2)])
  }
  for (let j = start; j <= start + 2; j++) {
    const s = shots[j]
    if (!s || !wholeShot(shots, j) || words(s.narration).length < MIN_PIECE_WORDS * 2) continue
    // Natural pause first; otherwise the word boundary nearest the middle (still never mid-word).
    const auto = autoPieces({ segmentId: s.segmentId, narration: s.narration, beat: s.beat, intent: s.intent, queries: s.queries, subject: s.subject }, 2)
    const w = words(s.narration)
    const texts = auto?.length === 2 ? auto.map((p) => p.text) : [w.slice(0, Math.floor(w.length / 2)).join(' '), w.slice(Math.floor(w.length / 2)).join(' ')]
    const first = words(texts[0]!).length
    // Each piece gets its own visual brief (the sentence's brief stays with the piece that matches it).
    const briefs = auto?.length === 2 ? auto : pieceBriefs(s, texts)
    const pieces: T2vPacedShot[] = [
      { ...s, intent: briefs[0]!.intent, subject: briefs[0]!.subject, queries: briefs[0]!.queries, narration: texts[0]!, wordOffset: 0, needS: r1(estimateS(texts[0]!) + 0.1) },
      { ...s, intent: briefs[1]!.intent, subject: briefs[1]!.subject, queries: briefs[1]!.queries, narration: texts[1]!, wordOffset: first, needS: r1(estimateS(texts[1]!) + (s.needS - estimateS(s.narration))) },
    ]
    out.push([...shots.slice(0, j), ...pieces, ...shots.slice(j + 1)])
  }
  return out
}

/**
 * Forced fix-up after the planner draws: while any 3 consecutive shot lengths are near-equal, apply the
 * merge/split of a neighbour that removes the most such runs (ties: higher CV). Stops when none remain or
 * no fix helps. Merges never cross a segment; splits only touch whole-sentence shots (pieces share one
 * narration clip, cut on a word boundary like every other split).
 */
export function forceBreakEqualRuns(input: T2vPacedShot[]): T2vPacedShot[] {
  let shots = input
  for (let guard = 0; guard < 24; guard++) {
    const lens = shots.map((s) => s.needS)
    const count = equalTriplets(lens)
    if (!count) break
    let start = -1
    for (let i = 2; i < lens.length && start < 0; i++) if (nearLen(lens[i - 2]!, lens[i - 1]!) && nearLen(lens[i - 1]!, lens[i]!)) start = i - 2
    let bestC: { shots: T2vPacedShot[]; count: number; cv: number } | null = null
    for (const c of fixCandidates(shots, start)) {
      const l = c.map((s) => s.needS)
      if (l.some((x) => x < 1.4)) continue
      const cand = { shots: c, count: equalTriplets(l), cv: pacingStats(l).cv }
      // Fewer runs first; then keep CV above the QA bar; then higher CV.
      const key = (x: { count: number; cv: number }) => x.count * 10 + (x.cv < PACING_MIN_CV ? 1 : 0) - Math.min(x.cv, 0.99)
      if (!bestC || key(cand) < key(bestC)) bestC = cand
    }
    if (!bestC || bestC.count >= count) break
    shots = bestC.shots
  }
  return shots
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
