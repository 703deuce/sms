import { describe, expect, it } from 'vitest'
import { findRetakes, retakeCutRange, splitSentences } from '@/lib/clips/editor/retakes'

function w(text: string, s: number, e: number) {
  return { w: text, s, e }
}

describe('retakes', () => {
  it('keeps the last attempt for immediate phrase repeat (rule A)', () => {
    const words = [
      w('We', 0, 0.2),
      w('need', 0.25, 0.45),
      w('to', 0.5, 0.6),
      w('go', 0.65, 0.8),
      w('We', 0.85, 1.0),
      w('need', 1.05, 1.25),
      w('to', 1.3, 1.4),
      w('go', 1.45, 1.6),
      w('today', 1.65, 1.9),
    ]
    const groups = findRetakes(words)
    expect(groups.length).toBe(1)
    expect(groups[0]?.keepIndex).toBe(1)
    const cut = retakeCutRange(groups[0]!, [])
    expect(cut).toEqual([0, 850])
  })

  it('emits separate groups for chained repeats (two attempts each)', () => {
    const words: ReturnType<typeof w>[] = []
    let t = 0
    for (let rep = 0; rep < 3; rep++) {
      if (rep > 0) t += 0.4
      for (const token of ['This', 'is', 'fine.']) {
        words.push(w(token, t, t + 0.2))
        t += 0.25
      }
    }
    const groups = findRetakes(words)
    expect(groups.length).toBeGreaterThanOrEqual(1)
    for (const g of groups) {
      expect(g.attempts.length).toBe(2)
      expect(g.keepIndex).toBe(1)
    }
  })

  it('ignores unrelated sentences', () => {
    const words = [
      w('One', 0, 0.2),
      w('two', 0.3, 0.5),
      w('three', 0.6, 0.8),
      w('Totally', 2, 2.2),
      w('different', 2.3, 2.5),
      w('line', 2.6, 2.8),
    ]
    expect(findRetakes(words)).toEqual([])
  })

  it('ignores pairs more than 4.5s apart', () => {
    const a = ['Start', 'the', 'show']
    const words = [
      ...a.map((x, i) => w(x, i * 0.2, i * 0.2 + 0.15)),
      ...a.map((x, i) => w(x, 5 + i * 0.2, 5 + i * 0.2 + 0.15)),
    ]
    expect(findRetakes(words)).toEqual([])
  })

  it('skips cut ranges that are already fully cut', () => {
    const group = {
      attempts: [
        { startMs: 1000, endMs: 2000, text: 'a b c' },
        { startMs: 5000, endMs: 6000, text: 'a b c d' },
      ],
      keepIndex: 1,
    }
    expect(retakeCutRange(group)).toEqual([1000, 5000])
    expect(retakeCutRange(group, [[1000, 5000]])).toBeNull()
  })

  it('splitSentences keeps short fragments for rule C adjacency', () => {
    expect(splitSentences([w('hi', 0, 0.2), w('bye', 0.3, 0.5)])).toEqual([
      [w('hi', 0, 0.2), w('bye', 0.3, 0.5)],
    ])
  })
})
