export type CropTrackShot = {
  start_ms: number
  end_ms: number
  spk: 'A' | 'B' | 'split' | 'wide' | string
}

/** v1 track from legacy speakercrop; v2 adds people/segments but keeps x0/x0_A/x0_B for preview. */
export type CropTrack = {
  v: 1 | 2
  W: number
  H: number
  cw: number
  fps: number
  t0_ms: number
  x0: number[]
  x0_A: number[]
  x0_B: number[]
  shots: CropTrackShot[]
  people?: { id: string; screen_s?: number }[]
  segments?: {
    layout: string
    start_ms: number
    end_ms: number
    slots?: string[]
  }[]
}

export function normalizeCropTrack(raw: unknown): CropTrack | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<CropTrack>
  if (!Array.isArray(o.shots) || o.shots.length === 0) return null
  const W = Number(o.W)
  const H = Number(o.H)
  const cw = Number(o.cw)
  const fps = Number(o.fps)
  const t0_ms = Number(o.t0_ms)
  if (![W, H, cw, fps, t0_ms].every((n) => Number.isFinite(n) && n > 0)) return null
  const shots = o.shots
    .filter((s) => s && typeof s === 'object')
    .map((s) => ({
      start_ms: Number((s as CropTrackShot).start_ms),
      end_ms: Number((s as CropTrackShot).end_ms),
      spk: String((s as CropTrackShot).spk ?? 'A'),
    }))
    .filter((s) => Number.isFinite(s.start_ms) && Number.isFinite(s.end_ms) && s.end_ms > s.start_ms)
  if (!shots.length) return null
  const x0 = Array.isArray(o.x0) ? o.x0.map((n) => Number(n)).filter((n) => Number.isFinite(n)) : []
  const x0_A = Array.isArray(o.x0_A) ? o.x0_A.map((n) => Number(n)).filter((n) => Number.isFinite(n)) : []
  const x0_B = Array.isArray(o.x0_B) ? o.x0_B.map((n) => Number(n)).filter((n) => Number.isFinite(n)) : []
  return {
    v: o.v === 2 ? 2 : 1,
    W,
    H,
    cw,
    fps,
    t0_ms,
    x0: x0.length ? x0 : [W / 2 - cw / 2],
    x0_A,
    x0_B,
    shots,
    people: o.people,
    segments: o.segments,
  }
}

export function shotAt(track: CropTrack, srcMs: number): { i: number; shot: CropTrackShot | null } {
  const shots = track.shots ?? []
  if (!shots.length) return { i: 0, shot: null }
  const i = shots.findIndex((s) => srcMs >= s.start_ms && srcMs < s.end_ms)
  if (i >= 0) return { i, shot: shots[i] }
  const last = shots[shots.length - 1]
  return { i: Math.max(0, shots.length - 1), shot: last ?? null }
}

export function cropPanX(track: CropTrack, frameIndex: number): number {
  const fi = Math.min(Math.max(0, frameIndex), Math.max(0, track.x0.length - 1))
  const x = track.x0[fi]
  if (x === undefined || Number.isNaN(x)) {
    return track.W / 2 - track.cw / 2
  }
  if (x >= 0) return x
  return track.W / 2 - track.cw / 2
}

export function shotsToCropShots(track: CropTrack) {
  return track.shots.map((s) => ({
    startMs: s.start_ms,
    endMs: s.end_ms,
    speaker: s.spk === 'split' ? 'SPLIT' : s.spk,
    cx: s.spk === 'B' ? 70 : 30,
    cy: 45,
    w: 100,
    h: 100,
  }))
}
