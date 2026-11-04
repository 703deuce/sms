import { describe, expect, it } from 'vitest'
import { refineWordCutWithAudio } from '@/lib/clips/editor/audio-cut-edges'
import { envelopeFromChannels } from '@/lib/clips/editor/fine-audio-envelope'

/** Level envelope (step ms): loud inside the given spans, room tone elsewhere. */
function env(loud: [number, number][], step = 5, endMs = 3000) {
  const out: { tMs: number; rms: number }[] = []
  for (let t = 0; t <= endMs; t += step) out.push({ tMs: t, rms: loud.some(([a, b]) => t >= a && t <= b) ? 0.3 : 0.003 })
  return out
}
const words = [
  { s: 0, e: 0.4 },
  { s: 0.6, e: 0.8 },
  { s: 1.0, e: 1.5 },
]

describe('SCRIPT_DOC3 audio word edges', () => {
  it('follows the audio when transcript times drift (um really 650-880, think ends 470)', () => {
    const r = refineWordCutWithAudio([600, 800], words, env([[0, 470], [650, 880], [1000, 1500]]))!
    expect(r.confidence).toBe('ready')
    expect(r.range[0]).toBeGreaterThan(470) // "think" whole
    expect(r.range[0]).toBeLessThan(650) // whole "um" removed
    expect(r.range[1]).toBeGreaterThan(880)
    expect(r.range[1]).toBeLessThan(1000) // "pr" whole
  })
  it('words that touch: cut at the energy valley, 5 ms into the deleted word', () => {
    const tight = [
      { s: 0, e: 0.6 },
      { s: 0.6, e: 0.8 },
      { s: 0.8, e: 1.5 },
    ]
    const e = env([[0, 1500]]).map((s) => ({ ...s, rms: Math.abs(s.tMs - 600) < 10 || Math.abs(s.tMs - 800) < 10 ? 0.05 : s.rms }))
    const r = refineWordCutWithAudio([600, 800], tight, e)!
    expect(r.confidence).toBe('ready')
    expect(r.range).toEqual([605, 795])
  })
  it('sentence delete keeps both neighbours', () => {
    const w4 = [...words, { s: 1.7, e: 2.0 }]
    const r = refineWordCutWithAudio([600, 1500], w4, env([[0, 400], [600, 800], [1000, 1500], [1700, 2000]]))!
    expect(r.range[0]).toBeGreaterThan(400)
    expect(r.range[1]).toBeGreaterThan(1500)
    expect(r.range[1]).toBeLessThan(1700)
  })
  it('works on the coarse 25 ms peaks too', () => {
    const r = refineWordCutWithAudio([600, 800], words, env([[0, 400], [600, 900], [1000, 1500]], 25))!
    expect(r.confidence).toBe('ready')
    expect(r.range[1]).toBeGreaterThan(900)
  })
  it('5 ms envelope from PCM', () => {
    const sr = 1000
    const ch = new Float32Array(100)
    ch.fill(0.5, 50)
    const e = envelopeFromChannels([ch], sr, 1000)
    expect(e).toHaveLength(20)
    expect(e[0]!.tMs).toBeCloseTo(1002.5)
    expect(e[0]!.rms).toBe(0)
    expect(e[19]!.rms).toBeCloseTo(0.5)
  })
})
