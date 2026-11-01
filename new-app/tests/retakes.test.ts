import { describe, expect, it } from 'vitest'
import { findRetakes, retakeCutRange, splitSentences } from '@/lib/clips/editor/retakes'

function w(text: string, s: number, e: number) {
  return { w: text, s, e }
}

describe('retakes', () => {
  it('keeps the last attempt for A / A′', () => {
    const words = [
      ...['We', 'need', 'to', 'go', 'now'].map((t, i) => w(t, i * 0.3, i * 0.3 + 0.25)),
      ...['We', 'need', 'to', 'go', 'today'].map((t, i) => w(t, 3 + i * 0.3, 3 + i * 0.3 + 0.25)),
    ]
    const groups = findRetakes(words)
    expect(groups.length).toBe(1)
    expect(groups[0]?.keepIndex).toBe(1)
  })

  it('collapses a chain of three', () => {
    const words: ReturnType<typeof w>[] = []
    let t = 0
    for (let rep = 0; rep < 3; rep++) {
      if (rep > 0) t += 1
      for (const token of ['This', 'is', 'fine.']) {
        words.push(w(token, t, t + 0.2))
        t += 0.25
      }
    }
    const groups = findRetakes(words)
    expect(groups[0]?.attempts.length).toBe(3)
    expect(groups[0]?.keepIndex).toBe(2)
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

  it('ignores pairs more than 45s apart', () => {
    const a = ['Start', 'the', 'show']
    const words = [
      ...a.map((x, i) => w(x, i * 0.2, i * 0.2 + 0.15)),
      ...a.map((x, i) => w(x, 50 + i * 0.2, 50 + i * 0.2 + 0.15)),
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

  it('splitSentences drops short sentences', () => {
    expect(splitSentences([w('hi', 0, 0.2), w('bye', 0.3, 0.5)])).toEqual([])
  })
})
