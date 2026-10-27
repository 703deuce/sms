import { describe, expect, it } from 'vitest'
import { gapCutBetweenSourceWords, gapShortenCutRange, listClipGapHits } from '@/lib/clips/gap-shorten'
import { toEditorWords } from '@/lib/clips/script-editor/to-editor-words'

describe('gapShortenCutRange', () => {
  it('shortens a 1s gap toward 350ms', () => {
    const range = gapShortenCutRange(10_000, 11_000, 1000, 350)
    expect(range).not.toBeNull()
    expect(range![1] - range![0]).toBeGreaterThan(500)
  })
})

describe('listClipGapHits', () => {
  it('drops gaps already cut', () => {
    const words = toEditorWords('clip:t', [
      { id: 'w0', text: 'hi', t0Ms: 0, t1Ms: 500, speakerId: 'a' },
      { id: 'w1', text: 'there', t0Ms: 2000, t1Ms: 2500, speakerId: 'a' },
    ])
    const cut = gapShortenCutRange(500, 2000, 1500, 350)!
    const hits = listClipGapHits(words, [cut], {
      mode: 'more_than',
      minGapMs: 600,
      targetGapMs: 350,
    })
    expect(hits).toHaveLength(0)
  })
})

describe('gapCutBetweenSourceWords', () => {
  it('finds pause cut between words', () => {
    const prev = { i: 0, s: 0, e: 0.5, w: 'a' }
    const next = { i: 1, s: 2, e: 2.5, w: 'b' }
    const cut = gapCutBetweenSourceWords(prev, next, [[600, 1400]])
    expect(cut).toEqual([600, 1400])
  })
})
