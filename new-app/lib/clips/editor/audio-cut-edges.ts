/**
 * SCRIPT_DOC2/3: cut edges come from the audio, not from the transcript timestamps.
 *
 * Transcript word times drift (speech speed varies), so each edge of a whole-word cut is searched
 * in a ±120 ms window around the transcript edge, on the finest audio envelope available (5 ms from
 * a browser decode of the clip, else the 25 ms peaks):
 *  - a quiet run (energy below an adaptive threshold between the local noise floor and the local
 *    speech level) nearest the transcript edge → cut in the middle of that quiet run;
 *  - no quiet run (words touch) → cut at the lowest-energy valley, moved 5 ms toward the deleted
 *    side so the kept word stays whole, and mark needs_review when the valley is still loud.
 * The preview and export fade every join (preview 20/25 ms volume ramp, export 20 ms afade), so a
 * cut at a valley does not click. Edges are saved in edits.cutRanges, which the export uses.
 */
import type { CutRange } from '@/lib/clips/edits'
import type { GapRmsSample } from '@/lib/clips/gap-audio-trim'

/** Audio level samples of the clip's program audio (source ms), registered by the editor shell. */
const registry = new Map<string, GapRmsSample[]>()

export function setCutAudioSamples(clipId: string, samples: GapRmsSample[]): void {
  if (samples.length) registry.set(clipId, samples)
  else registry.delete(clipId)
}

export function getCutAudioSamples(clipId: string): GapRmsSample[] | null {
  return registry.get(clipId) ?? null
}

export type AudioCutEdge = {
  range: CutRange
  confidence: 'ready' | 'needs_review'
  note: string
}

/** Search this far either side of the transcript edge. */
export const EDGE_SEARCH_MS = 120
/** Quiet = below floor + this share of (speech − floor). */
export const QUIET_SHARE = 0.15
/** A valley louder than floor + this share of (speech − floor) is flagged for review. */
export const LOUD_VALLEY_SHARE = 0.35
/** Valley cuts move this far into the deleted side so the kept word stays whole. */
export const VALLEY_BIAS_MS = 5
/** Tolerance (ms) for a range already refined earlier (re-refine must stay a word cut). */
const REFINED_SLACK_MS = EDGE_SEARCH_MS + 60

function pct(vals: number[], p: number): number {
  if (!vals.length) return 0
  const s = [...vals].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(s.length * p)))] ?? 0
}

type Edge = { ms: number; quiet: boolean; loud: boolean }

/**
 * One edge. `deletedSide` = +1 when the deleted words are after the edge (cut start), −1 when they
 * are before it (cut end).
 */
function findEdge(
  samples: GapRmsSample[],
  transcriptMs: number,
  deletedSide: 1 | -1,
  floor: number,
  speech: number,
  stepMs: number,
): Edge {
  // Window = ±EDGE_SEARCH_MS plus two samples, so a coarse envelope still sees the quiet next to the edge.
  const lo = transcriptMs - EDGE_SEARCH_MS - 2 * stepMs
  const hi = transcriptMs + EDGE_SEARCH_MS + 2 * stepMs
  const win = samples.filter((s) => s.tMs >= lo && s.tMs <= hi)
  if (!win.length) return { ms: transcriptMs, quiet: false, loud: true }
  const thr = floor + QUIET_SHARE * (speech - floor)
  // Quiet runs (contiguous samples at or below thr).
  const runs: [number, number][] = []
  let start: number | null = null
  let prevT = win[0]!.tMs
  for (const s of win) {
    if (s.rms <= thr) {
      if (start == null) start = s.tMs
      prevT = s.tMs
    } else if (start != null) {
      runs.push([start, prevT])
      start = null
    }
  }
  if (start != null) runs.push([start, prevT])
  if (runs.length) {
    let best = runs[0]!
    let bestD = Infinity
    for (const r of runs) {
      const d = transcriptMs < r[0] ? r[0] - transcriptMs : transcriptMs > r[1] ? transcriptMs - r[1] : 0
      if (d < bestD) {
        bestD = d
        best = r
      }
    }
    return { ms: Math.round((best[0] + best[1]) / 2), quiet: true, loud: false }
  }
  // Words touch: lowest-energy valley, nudged into the deleted side.
  let v = win[0]!
  for (const s of win) if (s.rms < v.rms || (s.rms === v.rms && Math.abs(s.tMs - transcriptMs) < Math.abs(v.tMs - transcriptMs))) v = s
  return {
    ms: Math.round(v.tMs + deletedSide * VALLEY_BIAS_MS),
    quiet: false,
    loud: v.rms > floor + LOUD_VALLEY_SHARE * (speech - floor),
  }
}

/**
 * Refine a cut over whole words. `words` are source spans in seconds. Returns null when the range
 * covers no word (a pause cut), is not a whole-word cut (a razor cut mid-word), or there is no
 * audio: callers then keep their existing behaviour.
 */
export function refineWordCutWithAudio(
  range: CutRange,
  words: { s: number; e: number }[],
  samples: GapRmsSample[] | null | undefined,
): AudioCutEdge | null {
  if (!samples?.length) return null
  const lo = Math.min(range[0], range[1])
  const hi = Math.max(range[0], range[1])
  const spans = words
    .map((w) => [Math.round(w.s * 1000), Math.round(w.e * 1000)] as const)
    .sort((a, b) => a[0] - b[0])
  const inside = spans.filter(([s, e]) => (s + e) / 2 >= lo && (s + e) / 2 < hi)
  if (!inside.length) return null
  const first = inside[0]!
  const last = inside[inside.length - 1]!
  const prevEnd = spans.filter(([s, e]) => (s + e) / 2 < lo).reduce<number | null>((m, [, e]) => (m == null ? e : Math.max(m, e)), null)
  const nextStart = spans.filter(([s, e]) => (s + e) / 2 >= hi).reduce<number | null>((m, [s]) => (m == null ? s : Math.min(m, s)), null)
  // Only whole-word cuts: each edge near the transcript edge of the cut words.
  if (Math.abs(lo - first[0]) > REFINED_SLACK_MS || Math.abs(hi - last[1]) > REFINED_SLACK_MS) return null

  const local = samples.filter((s) => s.tMs >= first[0] - 1500 && s.tMs <= last[1] + 1500).map((s) => s.rms)
  const floor = pct(local, 0.1)
  const speech = pct(local, 0.9)
  if (!(speech > floor * 1.5)) return null // no usable speech contrast

  const k = Math.min(samples.length - 1, 10)
  const stepMs = k > 0 ? Math.max(1, (samples[k]!.tMs - samples[0]!.tMs) / k) : 25
  const L = findEdge(samples, first[0], 1, floor, speech, stepMs)
  const R = findEdge(samples, last[1], -1, floor, speech, stepMs)
  let left = L.ms
  let right = R.ms
  // Never past the middle of a kept neighbour, never shorter than the cut words' middle.
  if (prevEnd != null) left = Math.max(left, prevEnd - EDGE_SEARCH_MS - 2 * stepMs)
  if (nextStart != null) right = Math.min(right, nextStart + EDGE_SEARCH_MS + 2 * stepMs)
  const firstMid = (first[0] + first[1]) / 2
  const lastMid = (last[0] + last[1]) / 2
  left = Math.min(left, Math.round(firstMid) - 1)
  right = Math.max(right, Math.round(lastMid) + 1)
  if (right - left < 20) return { range: [first[0], last[1]], confidence: 'needs_review', note: 'too narrow after refine' }

  const notes: string[] = []
  if (!L.quiet) notes.push(L.loud ? 'start runs into the previous word' : 'start at an energy valley')
  if (!R.quiet) notes.push(R.loud ? 'end runs into the next word' : 'end at an energy valley')
  return {
    range: [left, right],
    confidence: L.loud || R.loud ? 'needs_review' : 'ready',
    note: notes.join('; ') || 'audio edges',
  }
}
