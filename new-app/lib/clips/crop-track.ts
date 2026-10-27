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

export function shotAt(track: CropTrack, srcMs: number): { i: number; shot: CropTrackShot } {
  const i = track.shots.findIndex((s) => srcMs >= s.start_ms && srcMs < s.end_ms)
  if (i >= 0) return { i, shot: track.shots[i] }
  const last = track.shots[track.shots.length - 1]
  return { i: Math.max(0, track.shots.length - 1), shot: last }
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
