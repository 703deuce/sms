import { describe, expect, it } from 'vitest'
import { refineWordCutWithAudio } from '@/lib/clips/editor/audio-cut-edges'
import { alignCaptionText, captionTextFixEdits } from '@/lib/clips/editor/caption-text-fix'
import { mergeCleanupCutRanges } from '@/lib/clips/editor/cleanup-proposals'

/** 25 ms level samples: loud inside [a, b] spans, room tone elsewhere. */
function levels(loud: [number, number][], endMs = 3000) {
  const out: { tMs: number; rms: number }[] = []
  for (let t = 0; t <= endMs; t += 25) out.push({ tMs: t, rms: loud.some(([a, b]) => t >= a && t <= b) ? 0.3 : 0.003 })
  return out
}
// Fixture 1: "I think, um, probably Thursday." — think 0-400, um 600-800 (audible "m" to 900), probably 1000-1500.
const words = [
  { s: 0, e: 0.4 },
  { s: 0.6, e: 0.8 },
  { s: 1.0, e: 1.5 },
]

describe('SCRIPT_DOC2 audio cut edges', () => {
  it('removes the whole audible filler (trailing m) and keeps both neighbours', () => {
    const r = refineWordCutWithAudio([600, 800], words, levels([[0, 400], [600, 900], [1000, 1500]]))
    expect(r?.confidence).toBe('ready')
    expect(r!.range[0]).toBeGreaterThanOrEqual(400) // "think" intact
    expect(r!.range[0]).toBeLessThanOrEqual(600)
    expect(r!.range[1]).toBeGreaterThan(900) // trailing "m" gone
    expect(r!.range[1]).toBeLessThanOrEqual(1000) // "pr" intact
  })
  it('run-together filler is marked needs_review and never enters a neighbour', () => {
    const tight = [
      { s: 0, e: 0.6 },
      { s: 0.6, e: 0.8 },
      { s: 0.8, e: 1.5 },
    ]
    const r = refineWordCutWithAudio([600, 800], tight, levels([[0, 1500]]))
    expect(r?.confidence).toBe('needs_review')
    // SCRIPT_DOC3: valley cut, nudged into the deleted word so the kept words stay whole.
    expect(r!.range[0]).toBeGreaterThanOrEqual(600)
    expect(r!.range[1]).toBeLessThanOrEqual(800)
  })
  it('leaves non-word (razor / pause) cuts alone', () => {
    expect(refineWordCutWithAudio([420, 580], words, levels([[0, 400]]))).toBeNull()
    expect(refineWordCutWithAudio([700, 1200], words, levels([[0, 400]]))).toBeNull()
  })
  it('without audio, mergeCleanupCutRanges behaves as before', () => {
    const spans = words.map((w) => ({ ...w, w: 'x' }))
    expect(mergeCleanupCutRanges([], [[600, 800]], spans)).toEqual(mergeCleanupCutRanges([], [[600, 800]], spans, { rmsSamples: null }))
  })
})

describe('SCRIPT_DOC2 caption Correct text (text only)', () => {
  const W = (a: string[]) => a.map((w, i) => ({ i, w, sMs: i * 500, shown: w }))
  it('inserts a missed word without touching other words', () => {
    const m = alignCaptionText(W(['I', 'approve', 'it']), "I didn't approve it")!
    expect([...m.values()].join(' ')).toBe("I didn't approve it")
    expect(m.get(1)).toBe('approve')
  })
  it('fixes a name, case and punctuation 1:1', () => {
    const m = alignCaptionText(W(['scott', 'ally', 'said']), 'Scott Allie said.')!
    expect([...m.values()]).toEqual(['Scott', 'Allie', 'said.'])
  })
  it('a dropped word is hidden from captions, never cut', () => {
    const r = captionTextFixEdits({}, undefined, W(['so', 'um', 'yeah']), 'so yeah')!
    expect(r.wordFixes).toEqual({ '1': '' })
  })
  it('typing the original text back removes the fix', () => {
    const r = captionTextFixEdits({ '0': 'Hi' }, { '0': { s: 0, w: 'hi' } }, W(['hi']), 'hi')!
    expect(r.wordFixes).toEqual({})
    expect(r.wordFixMeta).toBeUndefined()
  })
  it('empty text is refused', () => {
    expect(captionTextFixEdits({}, undefined, W(['a']), '   ')).toBeNull()
  })
})
