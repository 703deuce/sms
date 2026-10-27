import { describe, expect, it } from 'vitest'
import {
  clipWordsToAbsolute,
  mergeClipWordsWithProjectTranscript,
} from '@/lib/server/clips/editor-words'
import { loadSourceWords } from '@/lib/clips/source-words'

describe('mergeClipWordsWithProjectTranscript', () => {
  const clipStart = 10_000
  const clipEnd = 40_000

  it('fills extend-trim window from project transcript', () => {
    const clipOnly = clipWordsToAbsolute(
      [{ w: 'mid', s: 5, e: 6, i: 5 }],
      clipStart,
      clipEnd,
    )
    const project = loadSourceWords([
      { w: 'before', s: 7, e: 7.5, i: 1 },
      { w: 'mid', s: 15, e: 16, i: 5 },
      { w: 'after', s: 50, e: 50.5, i: 9 },
    ])
    const merged = mergeClipWordsWithProjectTranscript(
      loadSourceWords(clipOnly),
      project,
      clipStart,
      clipEnd,
    )
    const texts = merged.map((w) => w.w)
    expect(texts).toContain('before')
    expect(texts).toContain('mid')
    expect(texts).not.toContain('after')
    const before = merged.find((w) => w.w === 'before')
    expect(before?.s).toBe(7)
  })
})
