import { describe, expect, it } from 'vitest'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { gapProposals } from '@/lib/clips/editor/cleanup-proposals'
import {
  cleanupPassConfirmMessage,
  cleanupPassNeedsConfirm,
  gapHasLoudProgramAudio,
  gapShortenCutRangeWithAudio,
  rmsSamplesFromPeaks,
} from '@/lib/clips/gap-audio-trim'

function loudGapSamples(gapStart: number, gapEnd: number): { tMs: number; rms: number }[] {
  const out: { tMs: number; rms: number }[] = []
  for (let t = gapStart; t <= gapEnd; t += 25) out.push({ tMs: t, rms: 0.35 })
  return out
}

function quietGapSamples(gapStart: number, gapEnd: number): { tMs: number; rms: number }[] {
  const out: { tMs: number; rms: number }[] = []
  for (let t = gapStart; t <= gapEnd; t += 25) out.push({ tMs: t, rms: 0.002 })
  return out
}

const words: EditorWord[] = [
  { id: 'w0', text: 'hey', t0Ms: 0, t1Ms: 400, isFiller: false } as EditorWord,
  { id: 'w1', text: 'pause', t0Ms: 2000, t1Ms: 2300, isFiller: false } as EditorWord,
  { id: 'w2', text: 'there', t0Ms: 8000, t1Ms: 8400, isFiller: false } as EditorWord,
]

describe('gap-audio-trim', () => {
  it('keeps a loud non-speech gap (game audio fixture)', () => {
    const rms = loudGapSamples(400, 5000)
    expect(gapHasLoudProgramAudio(400, 5000, rms)).toBe(true)
    expect(gapShortenCutRangeWithAudio(400, 5000, 4600, 250, rms)).toBeNull()
  })

  it('cuts a quiet gap fixture', () => {
    const rms = quietGapSamples(400, 2000)
    const cut = gapShortenCutRangeWithAudio(400, 2000, 1600, 250, rms)
    expect(cut).not.toBeNull()
    expect(cut![1] - cut![0]).toBeGreaterThan(100)
  })

  it('gapProposals skip loud gaps when RMS is provided', () => {
    const rms = [...quietGapSamples(400, 2000), ...loudGapSamples(2300, 8000)]
    const props = gapProposals(words, [], {
      mode: 'more_than',
      minGapMs: 600,
      targetGapMs: 250,
      rmsSamples: rms,
    })
    expect(props).toHaveLength(1)
    expect(props[0]?.kind).toBe('gap')
    expect(props[0]?.range[0]).toBeGreaterThanOrEqual(400)
    expect(props[0]?.range[1]).toBeLessThanOrEqual(2000)
  })

  it('builds RMS samples from peaks envelope', () => {
    const peaks = new Array(400).fill(0.5)
    const samples = rmsSamplesFromPeaks(peaks, 40)
    expect(samples.length).toBeGreaterThan(10)
    expect(samples[0]?.rms).toBe(0.5)
  })

  it('asks confirm when a pass removes >25% of duration', () => {
    expect(cleanupPassNeedsConfirm(10_000, 38_000)).toBe(true)
    expect(cleanupPassNeedsConfirm(5000, 38_000)).toBe(false)
    expect(cleanupPassConfirmMessage(26_000, 38_000)).toBe('This removes 26 s of 38 s. Continue?')
  })
})
