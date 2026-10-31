/**
 * G1b3: linked split edits (J / L cuts) on the main track.
 *
 * Model (`edits.splitEdits`, additive): `{ atMs, audioMs }[]`. `atMs` = MAIN SOURCE ms where the
 * right-hand keep segment of a real cut starts (the cut's identity, like E3 transitions), `audioMs`
 * = where the AUDIO switches relative to the picture cut on the edit timeline:
 *   > 0  L-cut — the outgoing clip's sound keeps playing under the incoming picture for audioMs;
 *   < 0  J-cut — the incoming clip's sound starts audioMs before its picture.
 * Video and audio stay linked (same keep segments, same total length); only the audio boundary
 * moves. With video segments S_i = [s_i, e_i] and effective offsets a_i (a_0 = a_n = 0) the audio
 * plays [s_i + a_i, e_i + a_{i+1}] back to back — export (worker split_edits.py) and preview
 * (preview-stage split-audio element) use the same function. Parity fixture g1b3_parity.json.
 */
import type { ClipEditsV2 } from '@/lib/clips/edits'

export type SplitEdit = { atMs: number; audioMs: number }

export const SPLIT_MAX_MS = 10_000
export const SPLIT_MAX_EDITS = 200
/** Shortest audio piece an offset may leave (each side keeps ≥ this). */
export const SPLIT_MIN_PIECE_MS = 100

export function normalizeSplitEdits(raw: unknown): SplitEdit[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const by = new Map<number, number>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const at = Math.round(Number(o.atMs))
    const v = Math.round(Number(o.audioMs))
    if (!Number.isFinite(at) || !Number.isFinite(v) || at < 0 || v === 0) continue
    by.set(at, Math.max(-SPLIT_MAX_MS, Math.min(SPLIT_MAX_MS, v)))
    if (by.size >= SPLIT_MAX_EDITS) break
  }
  const out = [...by.entries()].sort((a, b) => a[0] - b[0]).map(([atMs, audioMs]) => ({ atMs, audioMs }))
  return out.length ? out : undefined
}

/**
 * Effective offsets a[0..n] for keep segments in output order. Only real cuts (source jump ≥ 1 ms)
 * take an offset; |a_k| ≤ (min(len_{k-1}, len_k) − MIN) / 2 so every audio piece keeps ≥ MIN, and
 * the extended sound stays inside the trim window (the export's media range).
 */
export function splitOffsets(
  segs: readonly [number, number][],
  splits: readonly SplitEdit[] | undefined,
  trimIn: number,
  trimOut: number,
): number[] {
  const n = segs.length
  const a = new Array<number>(n + 1).fill(0)
  if (!splits?.length || n < 2) return a
  const m = new Map(splits.map((s) => [Math.round(s.atMs), Math.round(s.audioMs)]))
  for (let k = 1; k < n; k++) {
    const [p0, p1] = segs[k - 1]!
    const [q0, q1] = segs[k]!
    if (q0 - p1 < 1 && q0 - p1 > -1) continue
    let v = m.get(Math.round(q0)) ?? 0
    if (!v) continue
    const lim = Math.floor((Math.min(p1 - p0, q1 - q0) - SPLIT_MIN_PIECE_MS) / 2)
    if (lim <= 0) continue
    v = Math.max(-lim, Math.min(lim, v))
    if (v > 0) v = Math.min(v, Math.max(0, trimOut - p1))
    else v = Math.max(v, -Math.max(0, q0 - trimIn))
    a[k] = Math.round(v) + 0 // no -0
  }
  return a
}

/** Audio pieces (source ms), one per keep segment, in output order. */
export function audioSegments(segs: readonly [number, number][], offsets: readonly number[]): [number, number][] {
  return segs.map(([s, e], i) => [s + (offsets[i] ?? 0), e + (offsets[i + 1] ?? 0)])
}

export function hasSplitAudio(offsets: readonly number[]): boolean {
  return offsets.some((v) => v !== 0)
}

export type SplitPlan = { segs: [number, number][]; starts: number[]; offsets: number[] }

export function splitPlanFor(edits: ClipEditsV2, segs: [number, number][]): SplitPlan | null {
  const offsets = splitOffsets(segs, edits.splitEdits, edits.trim.in, edits.trim.out)
  if (!hasSplitAudio(offsets)) return null
  const starts: number[] = []
  let acc = 0
  for (const [a, b] of segs) {
    starts.push(acc)
    acc += b - a
  }
  return { segs, starts, offsets }
}

/**
 * Source ms of the SOUND at edit-timeline ms `outMs` when it differs from the picture's (inside a
 * J / L window), else null — the preview plays it from a second element and mutes the main one.
 */
export function splitAudioSrcAt(plan: SplitPlan | null, outMs: number): number | null {
  if (!plan) return null
  for (let k = 1; k < plan.segs.length; k++) {
    const v = plan.offsets[k]!
    if (!v) continue
    const T = plan.starts[k]!
    if (v > 0 && outMs >= T && outMs < T + v) return plan.segs[k - 1]![1] + (outMs - T)
    if (v < 0 && outMs >= T + v && outMs < T) return plan.segs[k]![0] + (outMs - T)
  }
  return null
}

/** Set / clear the audio offset of the cut whose right segment starts at `atMs`. */
export function setSplitEdit(edits: ClipEditsV2, atMs: number, audioMs: number): ClipEditsV2 {
  const rest = (edits.splitEdits ?? []).filter((s) => Math.abs(s.atMs - atMs) > 1)
  const list = normalizeSplitEdits(Math.round(audioMs) ? [...rest, { atMs: Math.round(atMs), audioMs: Math.round(audioMs) }] : rest)
  return { ...edits, splitEdits: list }
}

/** Current (requested) offset at a cut. */
export function splitEditAt(edits: ClipEditsV2, atMs: number): number {
  return edits.splitEdits?.find((s) => Math.abs(s.atMs - atMs) <= 1)?.audioMs ?? 0
}

/** Re-key split edits when a roll moves a cut's right segment start (keeps the J / L with the cut). */
export function moveSplitKey(edits: ClipEditsV2, fromAtMs: number, toAtMs: number, audioDelta = 0): ClipEditsV2 {
  const cur = splitEditAt(edits, fromAtMs)
  const rest = (edits.splitEdits ?? []).filter((s) => Math.abs(s.atMs - fromAtMs) > 1)
  const v = cur + audioDelta
  return { ...edits, splitEdits: normalizeSplitEdits(v ? [...rest, { atMs: toAtMs, audioMs: v }] : rest) }
}

/**
 * Keep split edits keyed to their cut across an EDL change (mirror of remapCutTransitions): a key
 * that is still a segment start stays; a moved right segment (same end) carries it; a vanished cut
 * drops it.
 */
export function remapSplitEdits(
  splits: SplitEdit[] | undefined,
  prevSegs: readonly [number, number][],
  nextSegs: readonly [number, number][],
): SplitEdit[] | undefined {
  if (!splits?.length) return splits
  const starts = nextSegs.slice(1).map(([a]) => a)
  let changed = false
  const out: SplitEdit[] = []
  for (const s of splits) {
    const hit = starts.find((a) => Math.abs(a - s.atMs) <= 1)
    if (hit !== undefined) {
      if (hit !== s.atMs) changed = true
      out.push(hit === s.atMs ? s : { ...s, atMs: hit })
      continue
    }
    changed = true
    const old = prevSegs.find(([a]) => Math.abs(a - s.atMs) <= 1)
    const moved = old ? nextSegs.slice(1).find(([, b]) => b === old[1]) : undefined
    if (moved) out.push({ ...s, atMs: moved[0] })
  }
  if (!changed) return splits
  return normalizeSplitEdits(out)
}
