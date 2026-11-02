/**
 * Q6.4 AU-20: optional strong-beat grid (downbeats / high-onset only) for cut-to-beat.
 */
import { BEAT_FRAME_MS, onsetEnvelope } from '@/lib/clips/editor/beats'

export type BeatCutStrength = 'all' | 'strong'

/** Keep beats whose onset energy is in the top tier, then thin to ~quarter-note downbeats. */
export function filterBeatsForCut(
  beatsMs: number[],
  strength: BeatCutStrength,
  samples?: Float32Array,
  sampleRate?: number,
): number[] {
  if (strength === 'all' || !beatsMs.length) return [...beatsMs].sort((a, b) => a - b)
  const sorted = [...beatsMs].sort((a, b) => a - b)
  if (!samples?.length || !sampleRate) {
    return sorted.filter((_, i) => i % 4 === 0)
  }
  const onset = onsetEnvelope(samples, sampleRate)
  const frameMs = (Math.max(1, Math.round((sampleRate * BEAT_FRAME_MS) / 1000)) * 1000) / sampleRate
  let peak = 0
  for (let i = 0; i < onset.length; i++) peak = Math.max(peak, onset[i]!)
  const floor = peak * 0.45
  const strong = sorted.filter((ms) => {
    const idx = Math.round(ms / frameMs)
    const v = onset[idx] ?? 0
    return v >= floor
  })
  if (strong.length >= 4) {
    return strong.filter((_, i) => i % 2 === 0)
  }
  return sorted.filter((_, i) => i % 4 === 0)
}
