import { describe, expect, it } from 'vitest'
import { findRetakes, retakeCutRange } from '@/lib/clips/editor/retakes'

function rw(text: string, s: number, e: number) {
  return { w: text, s, e }
}

describe('retakes (NASA interview regression)', () => {
  it('finds and then we / then we have some new guys false start', () => {
    const words = [
      rw('and', 27.0, 27.2),
      rw('then', 27.3, 27.5),
      rw('we', 27.55, 27.7),
      rw('then', 27.75, 27.9),
      rw('we', 27.95, 28.1),
      rw('have', 28.15, 28.35),
      rw('some', 28.4, 28.55),
      rw('new', 28.6, 28.75),
      rw('guys', 28.8, 29.1),
    ]
    const groups = findRetakes(words)
    const falseStart = groups.find((g) => g.attempts.some((a) => a.text.includes('then we')))
    expect(falseStart).toBeTruthy()
    const cut = retakeCutRange(falseStart!, [])
    expect(cut).toBeTruthy()
    expect(cut![1]! - cut![0]!).toBeLessThanOrEqual(15_000)
  })

  it('does not pair how this plays out with unrelated Bills season line', () => {
    const words = [
      ...Array.from({ length: 8 }, (_, i) => rw('word', 60 + i * 0.2, 60.2 + i * 0.2)),
      rw("we're", 67.0, 67.2),
      rw('gonna', 67.25, 67.45),
      rw('see', 67.5, 67.65),
      rw('how', 67.7, 67.85),
      rw('this', 67.9, 68.05),
      rw('how', 68.1, 68.25),
      rw('how', 68.3, 68.45),
      rw('it', 68.5, 68.6),
      rw('all', 68.65, 68.8),
      rw('plays', 68.85, 69.0),
      rw('out', 69.05, 69.2),
      rw('And', 72.0, 72.15),
      rw('you', 72.2, 72.35),
      rw('know', 72.4, 72.55),
      rw('man', 72.6, 72.75),
      rw('what', 72.8, 72.95),
      rw('a', 73.0, 73.05),
      rw('season', 73.1, 73.35),
      rw('last', 73.4, 73.55),
      rw('year', 73.6, 73.75),
      rw('for', 73.8, 73.95),
      rw('the', 74.0, 74.1),
      rw('Bills', 74.15, 74.4),
    ]
    const groups = findRetakes(words)
    const bad = groups.find((g) => {
      const texts = g.attempts.map((a) => a.text)
      return texts.some((t) => t.includes('plays out')) && texts.some((t) => t.includes('Bills'))
    })
    expect(bad).toBeUndefined()
  })
})
