import { describe, expect, it } from 'vitest'
import { gapHitIsRmsQuiet, gapHasLoudProgramAudio, type GapRmsSample } from '@/lib/clips/gap-audio-trim'
import { listClipGapHits } from '@/lib/clips/gap-shorten'
import { toEditorWords } from '@/lib/clips/script-editor/to-editor-words'

describe('gapHitIsRmsQuiet', () => {
  it('matches gapHasLoudProgramAudio negation', () => {
    const rms: GapRmsSample[] = [{ tMs: 500, rms: 0.5 }]
    expect(gapHitIsRmsQuiet(400, 5000, rms)).toBe(!gapHasLoudProgramAudio(400, 5000, rms))
  })

  it('listClipGapHits drops loud gameplay gaps when RMS provided', () => {
    const words = toEditorWords('clip:t', [
      { i: 0, w: 'a', s: 0, e: 0.5, spk: 0 },
      { i: 1, w: 'b', s: 14.4, e: 14.9, spk: 0 },
    ])
    const rms: GapRmsSample[] = []
    for (let t = 500; t <= 14_400; t += 25) rms.push({ tMs: t, rms: 0.45 })
    const without = listClipGapHits(words, [], {
      mode: 'more_than',
      minGapMs: 600,
      targetGapMs: 350,
    })
    expect(without).toHaveLength(1)
    const withRms = listClipGapHits(words, [], {
      mode: 'more_than',
      minGapMs: 600,
      targetGapMs: 350,
      rmsSamples: rms,
    })
    expect(withRms).toHaveLength(0)
  })
})
