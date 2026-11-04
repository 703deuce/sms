import { describe, expect, it } from 'vitest'
import { mergeClipWordsWithProjectTranscript } from '@/lib/clips/editor-words-merge'
import { clipWordsToAbsolute, resolveEditorWords } from '@/lib/server/clips/editor-words'
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

  it('backfills spk on clip words from project transcript index', () => {
    const clipOnly = loadSourceWords([{ w: 'mid', s: 15, e: 16, i: 5 }])
    const project = loadSourceWords([{ w: 'mid', s: 15, e: 16, spk: 1, i: 5 }])
    const merged = mergeClipWordsWithProjectTranscript(clipOnly, project, clipStart, clipEnd)
    expect(merged.find((w) => w.i === 5)?.spk).toBe(1)
  })
})


describe('extended trim transcript word loading (A2)', () => {
  it('returns source-timed project words outside the original clip but inside the requested trim', async () => {
    const clip = { id: 'clip', projectId: 'project', startMs: 100_000, endMs: 120_000, wordsKey: null }
    const projectWords = [
      { w: 'before', s: 98, e: 99, i: 1 },
      { w: 'inside', s: 110, e: 111, i: 10 },
      { w: 'extended', s: 125, e: 126, i: 25 },
    ]
    const words = await resolveEditorWords({} as never, 'ws', clip, projectWords, {
      preloadedClipWords: [{ w: 'inside', s: 10, e: 11, i: 10 }],
      trimInMs: 97_000,
      trimOutMs: 127_000,
      contextMs: 0,
    })
    expect(words.map((w) => w.w)).toEqual(['before', 'inside', 'extended'])
    expect(words.find((w) => w.w === 'extended')?.s).toBe(125)
  })

  it('falls back to the project transcript when the clip words file is missing', async () => {
    const clip = { id: 'clip', projectId: 'project', startMs: 100_000, endMs: 120_000, wordsKey: null }
    const words = await resolveEditorWords({} as never, 'ws', clip, [
      { w: 'project', s: 110, e: 111, i: 7 },
    ], { preloadedClipWords: [] })
    expect(words.map((w) => w.w)).toEqual(['project'])
  })
})
