import { describe, expect, it } from 'vitest'
import { dedupeAdjacentEditorWords } from '@/lib/clips/editor-words-dedupe'
import { clipWordsToAbsolute, resolveEditorWords } from '@/lib/server/clips/editor-words'
import type { ClipWord } from '@/lib/clips/edits'
import { loadSourceWords } from '@/lib/clips/source-words'

describe('STREAMER_editor_fix2 editor words', () => {
  it('dedupe drops same text within 60ms', () => {
    const words = loadSourceWords([
      { w: 'WHERE', s: 1.0, e: 1.2, i: 0 },
      { w: 'where', s: 1.01, e: 1.21, i: 1 },
      { w: 'next', s: 1.5, e: 1.7, i: 2 },
    ])
    const out = dedupeAdjacentEditorWords(words)
    expect(out.map((w) => w.w)).toEqual(['WHERE', 'next'])
  })

  it('resolveEditorWords prefers clip words.json and does not merge project transcript', async () => {
    const clipWords: ClipWord[] = [{ w: 'can', s: 0.47, e: 0.55, i: 0 }]
    const project: ClipWord[] = [{ w: 'can', s: 200.445, e: 200.5, i: 0 }]
    const clipStartMs = 199_965
    const clipEndMs = 223_395

    const storage = {
      getJson: async () => clipWords,
    } as never

    const resolved = await resolveEditorWords(
      storage,
      'ws1',
      {
        id: 'clip1',
        projectId: 'proj1',
        startMs: clipStartMs,
        endMs: clipEndMs,
        wordsKey: 'ws/ws1/projects/proj1/clips/clip1/words.json',
      },
      project,
      { preloadedClipWords: clipWords },
    )

    expect(resolved).toHaveLength(1)
    expect(resolved[0]!.w).toBe('can')
    expect(resolved[0]!.s).toBeCloseTo(clipStartMs / 1000 + 0.47, 2)
  })

  it('clipWordsToAbsolute shifts relative clip seconds to absolute timeline', () => {
    const rel: ClipWord[] = [{ w: 'hi', s: 0.5, e: 0.7, i: 0 }]
    const abs = clipWordsToAbsolute(rel, 199_965, 223_395)
    expect(abs[0]!.s).toBeCloseTo(199_965 / 1000 + 0.5, 3)
  })

  it('falls back to project transcript slice when clip words missing', async () => {
    const project: ClipWord[] = [
      { w: 'before', s: 100, e: 100.2, i: 0 },
      { w: 'in', s: 200.1, e: 200.3, i: 1 },
      { w: 'after', s: 300, e: 300.2, i: 2 },
    ]
    const storage = { getJson: async () => [] } as never
    const resolved = await resolveEditorWords(
      storage,
      'ws1',
      { id: 'c', projectId: 'p', startMs: 200_000, endMs: 210_000, wordsKey: null },
      project,
    )
    expect(resolved.map((w) => w.w)).toEqual(['in'])
  })
})
