/**
 * SCRIPT_DOC2: cut edges come from the audio, not from fixed padding.
 *
 * A word cut (a deleted word, phrase, sentence or filler) covers whole words. Each edge is moved to the
 * quietest point inside the gap next to it (between the previous kept word's end and the first cut
 * word's start; between the last cut word's end and the next kept word's start). The edge never
 * enters a kept word, so the worker's sanitize_cut_ranges keeps it unchanged and the export cuts
 * exactly where the preview cuts. When a gap has no quiet point (the words run together), the edge
 * stays on the ASR word edge and the result is marked needs_review.
 */
import type { CutRange } from '@/lib/clips/edits'
import type { GapRmsSample } from '@/lib/clips/gap-audio-trim'

/** Audio level samples (~25 ms) of the clip's program audio, registered by the editor shell. */
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

/** Gaps shorter than this have no room for a quiet edge (words run together). */
export const MIN_EDGE_GAP_MS = 15
/** When there is no neighbour word, search this far outside the cut words. */
export const OPEN_EDGE_SEARCH_MS = 200
/** A sample counts as quiet when it is at most this far above the local floor (dB). */
export const QUIET_DB_ABOVE_FLOOR = 6
/** Absolute quiet ceiling (linear, 0..1 peak scale): −30 dBFS. */
export const QUIET_MAX_LINEAR = 10 ** (-30 / 20)

function localFloor(samples: GapRmsSample[], lo: number, hi: number): number {
  const vals = samples.filter((s) => s.tMs >= lo - 1500 && s.tMs <= hi + 1500).map((s) => s.rms)
  if (!vals.length) return 0
  vals.sort((a, b) => a - b)
  return vals[Math.floor(vals.length * 0.1)] ?? 0
}

/** Lowest sample in [lo, hi] if it is quiet; prefers the point nearest `prefer` on ties. */
function quietestPoint(samples: GapRmsSample[], lo: number, hi: number, thr: number, prefer: number): number | null {
  let best: GapRmsSample | null = null
  for (const s of samples) {
    if (s.tMs < lo || s.tMs > hi) continue
    if (s.rms > thr) continue
    if (!best || s.rms < best.rms || (s.rms === best.rms && Math.abs(s.tMs - prefer) < Math.abs(best.tMs - prefer))) best = s
  }
  return best ? best.tMs : null
}

/**
 * Refine a cut over whole words. `words` are source spans in seconds (sorted or not).
 * Returns null when the range covers no word (a pause cut) or there is no audio: callers then keep
 * their existing behaviour.
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
  const prevEnd = spans.filter(([s, e]) => e <= first[0] && (s + e) / 2 < lo).reduce<number | null>((m, [, e]) => (m == null ? e : Math.max(m, e)), null)
  const nextStart = spans.filter(([s, e]) => s >= last[1] && (s + e) / 2 >= hi).reduce<number | null>((m, [s]) => (m == null ? s : Math.min(m, s)), null)
  // Only whole-word cuts (transcript deletes, fillers, retakes): both edges sit in the gaps around
  // the cut words or within 80 ms inside them. Anything else (a razor cut mid-word) is left alone.
  if (prevEnd != null && lo < prevEnd - 1) return null
  if (nextStart != null && hi > nextStart + 1) return null
  if (lo > first[0] + 80 || hi < last[1] - 80) return null
  const floor = localFloor(samples, first[0], last[1])
  const thr = Math.min(QUIET_MAX_LINEAR, Math.max(floor, 1e-4) * 10 ** (QUIET_DB_ABOVE_FLOOR / 20))

  let confidence: AudioCutEdge['confidence'] = 'ready'
  const notes: string[] = []

  // Left edge: quiet point between the previous kept word and the first cut word.
  const leftLo = prevEnd ?? first[0] - OPEN_EDGE_SEARCH_MS
  const leftHi = first[0]
  let left = first[0]
  if (leftHi - leftLo >= MIN_EDGE_GAP_MS) {
    const q = quietestPoint(samples, leftLo, leftHi, thr, leftHi)
    if (q != null) left = Math.round(q)
    else {
      confidence = 'needs_review'
      notes.push('no quiet point before the cut')
    }
  } else if (prevEnd != null) {
    confidence = 'needs_review'
    notes.push('runs into the previous word')
  }

  // Right edge: quiet point between the last cut word and the next kept word.
  const rightLo = last[1]
  const rightHi = nextStart ?? last[1] + OPEN_EDGE_SEARCH_MS
  let right = last[1]
  if (rightHi - rightLo >= MIN_EDGE_GAP_MS) {
    const q = quietestPoint(samples, rightLo, rightHi, thr, rightLo)
    if (q != null) right = Math.round(q)
    else {
      confidence = 'needs_review'
      notes.push('no quiet point after the cut')
    }
  } else if (nextStart != null) {
    confidence = 'needs_review'
    notes.push('runs into the next word')
  }

  // Never enter a kept word; always cover the cut words completely.
  if (prevEnd != null) left = Math.max(left, prevEnd)
  if (nextStart != null) right = Math.min(right, nextStart)
  left = Math.min(left, first[0])
  right = Math.max(right, last[1])
  return { range: [left, right], confidence, note: notes.join('; ') || 'audio edges' }
}
