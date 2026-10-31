/**
 * E4 per-item speed (0.25×–4×, pitch-preserved). Source-anchored like E4 color looks: a speed covers
 * SOURCE ms [fromMs, toMs) of the main video, so it survives ripple, reorder and silence trim.
 *
 * Timing contract: every lane (captions, hook, text, B-roll, music, SFX, keyframes, transitions) stays
 * in EDIT time (the E2/E3 output timeline). The worker renders in edit time, then one export post-step
 * warps the whole finished clip piecewise (video setpts + atempo, the SRT by the same map) — exactly
 * what the existing global 1.1/1.25/1.5× speed already does for the whole clip. Because everything is
 * warped together, burned captions and overlays cannot drift. The preview plays every media element at
 * playbackRate = global × speedAt(current source ms) with preservesPitch.
 *
 * No imports, so lib/clips/edits.ts can use it. Mirrored by worker clips_worker/speed.py.
 */

export type SegmentSpeed = { fromMs: number; toMs: number; speed: number }
export const SPEED_MIN = 0.25
export const SPEED_MAX = 4
export const SPEED_PRESETS: readonly number[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const

/** Warp piece in EDIT ms (output timeline before the speed post-step). */
export type WarpPiece = { startMs: number; endMs: number; speed: number }

export function clampSpeed(s: number): number {
  const n = Number(s)
  if (!Number.isFinite(n) || n <= 0) return 1
  return Math.round(Math.min(SPEED_MAX, Math.max(SPEED_MIN, n)) * 100) / 100
}

export function normalizeSegmentSpeeds(raw: unknown): SegmentSpeed[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: SegmentSpeed[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const a = Math.round(Number(o.fromMs))
    const b = Math.round(Number(o.toMs))
    const s = clampSpeed(Number(o.speed))
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a || s === 1) continue
    out.push({ fromMs: Math.max(0, a), toMs: b, speed: s })
  }
  out.sort((x, y) => x.fromMs - y.fromMs)
  // Overlaps: the later range wins from its start (setSegmentSpeed never creates them).
  const clean: SegmentSpeed[] = []
  for (const s of out) {
    const prev = clean[clean.length - 1]
    if (prev && prev.toMs > s.fromMs) prev.toMs = s.fromMs
    if (prev && prev.toMs <= prev.fromMs) clean.pop()
    clean.push({ ...s })
  }
  return clean.length ? clean.slice(0, 200) : undefined
}

export function speedAtSource(speeds: SegmentSpeed[] | undefined, srcMs: number): number {
  for (const s of speeds ?? []) if (srcMs >= s.fromMs && srcMs < s.toMs) return s.speed
  return 1
}

/** Set the speed of SOURCE [fromMs, toMs) (speed 1 clears it). */
export function setSegmentSpeed(
  speeds: SegmentSpeed[] | undefined,
  fromMs: number,
  toMs: number,
  speed: number,
): SegmentSpeed[] | undefined {
  const next: SegmentSpeed[] = []
  for (const s of speeds ?? []) {
    if (s.toMs <= fromMs || s.fromMs >= toMs) {
      next.push(s)
      continue
    }
    if (s.fromMs < fromMs) next.push({ ...s, toMs: fromMs })
    if (s.toMs > toMs) next.push({ ...s, fromMs: toMs })
  }
  const sp = clampSpeed(speed)
  if (sp !== 1) next.push({ fromMs: Math.round(fromMs), toMs: Math.round(toMs), speed: sp })
  return normalizeSegmentSpeeds(next)
}

/**
 * Edit-time warp pieces for the ordered keep segments (source ms). Each segment is split where a
 * speed range starts / ends; adjacent pieces with the same speed merge. Pieces cover [0, total).
 */
export function speedWarpPieces(segments: readonly (readonly [number, number])[], speeds: SegmentSpeed[] | undefined): WarpPiece[] {
  const out: WarpPiece[] = []
  let t = 0
  const push = (len: number, speed: number) => {
    if (len <= 0) return
    const prev = out[out.length - 1]
    if (prev && prev.speed === speed) prev.endMs += len
    else out.push({ startMs: t, endMs: t + len, speed })
    t += len
  }
  for (const [a, b] of segments) {
    if (b <= a) continue
    const cuts = new Set<number>([a, b])
    for (const s of speeds ?? []) {
      if (s.fromMs > a && s.fromMs < b) cuts.add(s.fromMs)
      if (s.toMs > a && s.toMs < b) cuts.add(s.toMs)
    }
    const pts = [...cuts].sort((x, y) => x - y)
    for (let i = 0; i < pts.length - 1; i++) push(pts[i + 1] - pts[i], speedAtSource(speeds, pts[i]))
  }
  return out
}

export function hasSpeedChange(pieces: WarpPiece[]): boolean {
  return pieces.some((p) => p.speed !== 1)
}

/** Edit ms → warped (real) ms. */
export function warpMs(pieces: WarpPiece[], editMs: number): number {
  let real = 0
  for (const p of pieces) {
    if (editMs <= p.startMs) break
    real += (Math.min(editMs, p.endMs) - p.startMs) / p.speed
  }
  const last = pieces[pieces.length - 1]
  if (last && editMs > last.endMs) real += editMs - last.endMs
  return real
}

/** Warped (real) ms → edit ms. */
export function unwarpMs(pieces: WarpPiece[], realMs: number): number {
  let real = 0
  for (const p of pieces) {
    const len = (p.endMs - p.startMs) / p.speed
    if (realMs <= real + len) return p.startMs + (realMs - real) * p.speed
    real += len
  }
  const last = pieces[pieces.length - 1]
  return (last?.endMs ?? 0) + (realMs - real)
}

export function warpedDurationMs(pieces: WarpPiece[]): number {
  return pieces.reduce((s, p) => s + (p.endMs - p.startMs) / p.speed, 0)
}

/** ffmpeg atempo factors (each within [0.5, 2]) whose product is `speed`. */
export function atempoChain(speed: number): number[] {
  let s = speed
  const out: number[] = []
  while (s > 2 + 1e-9) {
    out.push(2)
    s /= 2
  }
  while (s < 0.5 - 1e-9) {
    out.push(0.5)
    s /= 0.5
  }
  out.push(Math.round(s * 1e6) / 1e6)
  return out
}
