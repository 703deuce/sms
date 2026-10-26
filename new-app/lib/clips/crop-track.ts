export type CropTrackShot = {
  start_ms: number
  end_ms: number
  spk: 'A' | 'B' | 'split'
}

export type CropTrack = {
  v: 1
  W: number
  H: number
  cw: number
  fps: number
  t0_ms: number
  x0: number[]
  x0_A: number[]
  x0_B: number[]
  shots: CropTrackShot[]
}

export function shotAt(track: CropTrack, srcMs: number): { i: number; shot: CropTrackShot } {
  const i = track.shots.findIndex((s) => srcMs >= s.start_ms && srcMs < s.end_ms)
  if (i >= 0) return { i, shot: track.shots[i] }
  const last = track.shots[track.shots.length - 1]
  return { i: Math.max(0, track.shots.length - 1), shot: last }
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
