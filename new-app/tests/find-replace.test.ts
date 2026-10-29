import { describe, expect, it } from 'vitest'
import { findMatches, replacementFixes } from '@/lib/clips/editor/find-replace'
import { buildCaptionWords } from '@/lib/clips/caption-words'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'

const words: SourceWord[] = [
  { i: 0, w: 'hello', s: 0, e: 0.4 },
  { i: 1, w: 'world.', s: 0.4, e: 0.8 },
  { i: 2, w: 'again', s: 0.8, e: 1.2 },
]

describe('find-replace', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 5000, trimMinMs: 0, trimMaxMs: 5000 }

  it('matches phrases and replaces 2→1 with hidden tail word', () => {
    const edits = normalizeEdits(defaultEdits(bounds), bounds)
    edits.trim = { in: 0, out: 2000 }
    const matches = findMatches(words, edits, 'hello world')
    expect(matches.length).toBe(1)
    const rep = replacementFixes(words, matches[0]!, 'hi')
    expect(rep.fixes['0']).toBe('hi.')
    expect(rep.fixes['1']).toBe('')
    const merged = normalizeEdits({ ...edits, wordFixes: rep.fixes, wordFixMeta: rep.meta }, bounds)
    expect(merged.wordFixMeta?.['1']).toEqual({ s: 400, w: 'world.' })
    const caps = buildCaptionWords(words, merged)
    expect(caps.some((c) => c.text.includes('world'))).toBe(false)
  })
})
