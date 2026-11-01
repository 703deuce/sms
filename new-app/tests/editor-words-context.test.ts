import { describe, expect, it } from 'vitest'
import { mergeClipWordsWithProjectTranscript } from '@/lib/clips/editor-words-merge'
import { loadSourceWords } from '@/lib/clips/source-words'

describe('editor-words contextMs', () => {
  const clipStart = 60_000
  const clipEnd = 90_000
  const project = loadSourceWords([
    { w: 'far-before', s: 10, e: 10.5, i: 1 },
    { w: 'near-before', s: 58, e: 58.5, i: 2 },
    { w: 'in-clip', s: 70, e: 70.5, i: 3 },
    { w: 'near-after', s: 92, e: 92.5, i: 4 },
    { w: 'far-after', s: 200, e: 200.5, i: 5 },
  ])
  const clipWords = loadSourceWords([{ w: 'in-clip', s: 70, e: 70.5, i: 3 }])

  it('default extend matches prior ±8s window', () => {
    const merged = mergeClipWordsWithProjectTranscript(clipWords, project, clipStart, clipEnd)
    const texts = merged.map((w) => w.w)
    expect(texts).toContain('near-before')
    expect(texts).not.toContain('far-before')
  })

  it('contextMs widens merge window', () => {
    const merged = mergeClipWordsWithProjectTranscript(
      clipWords,
      project,
      clipStart,
      clipEnd,
      60_000,
    )
    const texts = merged.map((w) => w.w)
    expect(texts).toContain('far-before')
    expect(texts).toContain('near-after')
  })

  it('contextMs clamped to trim limits', () => {
    const merged = mergeClipWordsWithProjectTranscript(
      clipWords,
      project,
      clipStart,
      clipEnd,
      60_000,
      undefined,
      { minMs: 55_000, maxMs: 95_000 },
    )
    const texts = merged.map((w) => w.w)
    expect(texts).not.toContain('far-before')
    expect(texts).toContain('near-before')
  })
})
