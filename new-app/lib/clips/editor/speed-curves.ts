/**
 * G4b speed curves (CapCut Speed → Curve): a preset ramp over a Video item's SOURCE range compiled
 * into stepped `segmentSpeeds` pieces. The existing E4 speed path (preview playbackRate per piece,
 * export setpts + atempo warp of the whole clip, captions / overlays follow) renders them unchanged,
 * so preview = export by construction. No new schema.
 */
import { clampSpeed, normalizeSegmentSpeeds, setSegmentSpeed, speedAtSource, type SegmentSpeed } from '@/lib/clips/editor/speed'

export type SpeedCurveId = 'montage' | 'hero' | 'bullet' | 'ramp_up' | 'ramp_down' | 'flash_in' | 'flash_out'
/** Control points (u in [0, 1] of the item, speed ×); interpolated in log2(speed). */
export const SPEED_CURVES: Record<SpeedCurveId, { label: string; pts: readonly (readonly [number, number])[] }> = {
  montage: { label: 'Montage', pts: [[0, 2], [0.35, 0.5], [0.65, 0.5], [1, 2]] },
  hero: { label: 'Hero', pts: [[0, 1], [0.35, 0.3], [0.65, 0.3], [1, 1]] },
  bullet: { label: 'Bullet', pts: [[0, 3], [0.4, 0.25], [0.6, 0.25], [1, 3]] },
  ramp_up: { label: 'Ramp up', pts: [[0, 0.5], [1, 3]] },
  ramp_down: { label: 'Ramp down', pts: [[0, 3], [1, 0.5]] },
  flash_in: { label: 'Flash in', pts: [[0, 4], [0.5, 1], [1, 1]] },
  flash_out: { label: 'Flash out', pts: [[0, 1], [0.5, 1], [1, 4]] },
}
export const SPEED_CURVE_IDS = Object.keys(SPEED_CURVES) as SpeedCurveId[]
export const CURVE_PIECES = 8
export const CURVE_MIN_PIECE_MS = 150

export function curveSpeedAt(id: SpeedCurveId, u: number): number {
  const pts = SPEED_CURVES[id].pts
  const x = Math.min(1, Math.max(0, u))
  for (let i = 0; i < pts.length - 1; i++) {
    const [u0, s0] = pts[i]!
    const [u1, s1] = pts[i + 1]!
    if (x <= u1) {
      const t = u1 > u0 ? (x - u0) / (u1 - u0) : 0
      return 2 ** (Math.log2(s0) + (Math.log2(s1) - Math.log2(s0)) * t)
    }
  }
  return pts[pts.length - 1]![1]
}

/** Stepped pieces (speed at each piece's midpoint, rounded to 0.05×) covering source [fromMs, toMs). */
export function curvePieces(id: SpeedCurveId, fromMs: number, toMs: number): SegmentSpeed[] {
  const a = Math.round(fromMs)
  const b = Math.round(toMs)
  if (!(b > a)) return []
  const n = Math.max(1, Math.min(CURVE_PIECES, Math.floor((b - a) / CURVE_MIN_PIECE_MS)))
  const out: SegmentSpeed[] = []
  for (let i = 0; i < n; i++) {
    const p0 = a + Math.round(((b - a) * i) / n)
    const p1 = a + Math.round(((b - a) * (i + 1)) / n)
    const s = clampSpeed(Math.round(curveSpeedAt(id, (i + 0.5) / n) * 20) / 20)
    out.push({ fromMs: p0, toMs: p1, speed: s })
  }
  return out
}

/** Replace the speeds of source [fromMs, toMs) with the curve's pieces. */
export function applySpeedCurve(speeds: SegmentSpeed[] | undefined, fromMs: number, toMs: number, id: SpeedCurveId): SegmentSpeed[] | undefined {
  const cleared = setSegmentSpeed(speeds, fromMs, toMs, 1) ?? []
  return normalizeSegmentSpeeds([...cleared, ...curvePieces(id, fromMs, toMs)])
}

/** The preset whose pieces exactly match what is stored on [fromMs, toMs), or null. */
export function matchSpeedCurve(speeds: SegmentSpeed[] | undefined, fromMs: number, toMs: number): SpeedCurveId | null {
  for (const id of SPEED_CURVE_IDS) {
    const want = curvePieces(id, fromMs, toMs)
    if (want.length > 1 && want.every((p) => speedAtSource(speeds, (p.fromMs + p.toMs) / 2) === p.speed)) return id
  }
  return null
}
