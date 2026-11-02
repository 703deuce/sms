import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findRetakes, retakeCutRange } from '@/lib/clips/editor/retakes'
import { loadSourceWords, wordsInRange } from '@/lib/clips/source-words'

const fixturePath = join(process.cwd(), 'tests/fixtures/cleanup-proj-eb785762-transcript-words.json')
const clipStartMs = 800
const clipEndMs = 81875

function loadRetakeWords() {
  const raw = JSON.parse(readFileSync(fixturePath, 'utf8'))
  const scoped = wordsInRange(
    loadSourceWords(raw.map((w: { w: string; s: number; e: number }, i: number) => ({ ...w, i }))),
    clipStartMs,
    clipEndMs,
  )
  return scoped.map((w) => ({ w: w.w, s: w.s ?? 0, e: w.e ?? 0 }))
}

function wordsInTimeRange(words: ReturnType<typeof loadRetakeWords>, startS: number, endS: number) {
  return words.filter((w) => w.s >= startS - 0.01 && w.e <= endS + 0.01)
}

function near(a: number, b: number, tol = 300) {
  return Math.abs(a - b) <= tol
}

describe('retakes prod clip_fb811840 (proj_eb785762 fixture)', () => {
  const words = loadRetakeWords()

  it('finds exactly three grounded retake cuts on full trim window', () => {
    const groups = findRetakes(words)
    const cuts = groups.map((g) => retakeCutRange(g, [])).filter(Boolean) as [number, number][]
    expect(cuts).toHaveLength(3)
    expect(cuts.some(([a, b]) => near(a, 27940) && near(b, 28260))).toBe(true)
    expect(cuts.some(([a, b]) => near(a, 38500) && near(b, 41060))).toBe(true)
    expect(cuts.some(([a, b]) => near(a, 67440) && near(b, 68080))).toBe(true)
    const removed = cuts.reduce((s, [a, b]) => s + (b - a), 0)
    expect(removed).toBeLessThan(6000)
    for (const [a, b] of cuts) {
      expect(b - a).toBeLessThanOrEqual(4000)
    }
    const badStarts = [10480, 24575, 42755, 50835, 70585]
    for (const start of badStarts) {
      expect(cuts.some(([a]) => a === start)).toBe(false)
    }
  })

  it('24.575–29.54 s window: only then-we cut', () => {
    const slice = wordsInTimeRange(words, 24.575, 29.54)
    const cuts = findRetakes(slice)
      .map((g) => retakeCutRange(g, []))
      .filter(Boolean) as [number, number][]
    expect(cuts).toHaveLength(1)
    expect(near(cuts[0]![0], 27940)).toBe(true)
    expect(near(cuts[0]![1], 28260)).toBe(true)
  })

  it('70.585–76.985 s window: no retakes', () => {
    const slice = wordsInTimeRange(words, 70.585, 76.985)
    expect(findRetakes(slice)).toHaveLength(0)
  })

  it('10.48–21.14 s window: no retakes', () => {
    const slice = wordsInTimeRange(words, 10.48, 21.14)
    expect(findRetakes(slice)).toHaveLength(0)
  })

  it('38.18–41.86 s window: We… / old guys cut', () => {
    const slice = wordsInTimeRange(words, 38.18, 41.86)
    const cuts = findRetakes(slice)
      .map((g) => retakeCutRange(g, []))
      .filter(Boolean) as [number, number][]
    expect(cuts).toHaveLength(1)
    expect(near(cuts[0]![0], 38500)).toBe(true)
    expect(near(cuts[0]![1], 41060)).toBe(true)
  })

  it('64.72–69.60 s window: how this restart cut', () => {
    const slice = wordsInTimeRange(words, 64.72, 69.6)
    const cuts = findRetakes(slice)
      .map((g) => retakeCutRange(g, []))
      .filter(Boolean) as [number, number][]
    expect(cuts).toHaveLength(1)
    expect(near(cuts[0]![0], 67440)).toBe(true)
    expect(near(cuts[0]![1], 68080)).toBe(true)
  })
})
