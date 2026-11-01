import { describe, expect, it } from 'vitest'
import { findRetakes } from '@/lib/clips/editor/retakes'

function w(text: string, s: number, e: number) {
  return { w: text, s, e }
}

describe('retakes false-start (AI_QUALITY Q2)', () => {
  it('detects repeated opener after false start in one breath', () => {
    const words = [
      w('I', 0, 0.1),
      w('want', 0.12, 0.25),
      w('to—', 0.26, 0.35),
      w('I', 0.36, 0.42),
      w('want', 0.43, 0.55),
      w('to', 0.56, 0.62),
      w('go', 0.63, 0.75),
      w('now', 0.76, 0.9),
    ]
    const groups = findRetakes(words)
    expect(groups.length).toBeGreaterThanOrEqual(1)
  })
})
