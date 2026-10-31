import { describe, expect, it } from 'vitest'
import { beatsToOutput, detectBeats } from '@/lib/clips/editor/beats'

/** Clicks (short decaying noise bursts) every `periodMs` from `firstMs`, over a quiet noise bed. */
function clickTrack(seconds: number, periodMs: number, firstMs: number, sr = 22_050): Float32Array {
  const out = new Float32Array(Math.round(seconds * sr))
  let seed = 7
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff - 0.5
  }
  for (let i = 0; i < out.length; i++) out[i] = rnd() * 0.01
  for (let t = firstMs; t < seconds * 1000; t += periodMs) {
    const a = Math.round((t / 1000) * sr)
    for (let k = 0; k < sr * 0.03 && a + k < out.length; k++) out[a + k]! += rnd() * 1.6 * Math.exp(-k / (sr * 0.006))
  }
  return out
}

function hitRate(found: number[], periodMs: number, firstMs: number, tolMs: number): number {
  if (!found.length) return 0
  const ok = found.filter((b) => {
    const k = Math.round((b - firstMs) / periodMs)
    return Math.abs(b - (firstMs + k * periodMs)) <= tolMs
  })
  return ok.length / found.length
}

describe('G2 beat detection (local)', () => {
  it('finds 120 BPM and lands on the clicks', () => {
    const g = detectBeats(clickTrack(30, 500, 250), 22_050)
    expect(Math.abs(g.bpm - 120)).toBeLessThan(2)
    expect(g.beatsMs.length).toBeGreaterThan(50)
    expect(hitRate(g.beatsMs, 500, 250, 30)).toBeGreaterThan(0.9)
  })

  it('finds 100 BPM with an offset start', () => {
    const g = detectBeats(clickTrack(30, 600, 130), 22_050)
    expect(Math.abs(g.bpm - 100)).toBeLessThan(2)
    expect(hitRate(g.beatsMs, 600, 130, 30)).toBeGreaterThan(0.9)
  })

  it('returns nothing for silence or very short audio', () => {
    expect(detectBeats(new Float32Array(22_050 * 10), 22_050).beatsMs).toEqual([])
    expect(detectBeats(clickTrack(2, 500, 0), 22_050).beatsMs).toEqual([])
  })

  it('maps media beats onto the timeline (window, in-point, loop)', () => {
    const beats = [0, 500, 1000, 1500]
    expect(beatsToOutput(beats, { startMs: 1000, endMs: 2600, inMs: 500 }, 2000)).toEqual([1000, 1500, 2000])
    // Looping 2 s media in a 5 s window repeats the grid every 2 s.
    expect(beatsToOutput(beats, { startMs: 0, endMs: 5000, inMs: 0 }, 2000, true)).toEqual([0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500])
  })
})
