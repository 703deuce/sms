import { describe, expect, it } from 'vitest'
import { clipWordsToAbsolute } from './editor-words'

const w = (s: number, e: number) => ({ w: 'x', s, e, i: 0 })
describe('clipWordsToAbsolute FIX1', () => {
  it('offsets relative words for a clip that starts before its own length', () => {
    const out = clipWordsToAbsolute([w(0.1, 0.4), w(39, 39.5)], 20_000, 60_000)
    expect(out[0].s).toBeCloseTo(20.1)
  })
  it('leaves absolute words alone', () => {
    const out = clipWordsToAbsolute([w(120.2, 120.5), w(150, 150.4)], 120_000, 160_000)
    expect(out[0].s).toBeCloseTo(120.2)
  })
  it('still offsets the classic far-into-video case', () => {
    const out = clipWordsToAbsolute([w(0.2, 0.5), w(30, 30.4)], 600_000, 632_000)
    expect(out[0].s).toBeCloseTo(600.2)
  })
})
