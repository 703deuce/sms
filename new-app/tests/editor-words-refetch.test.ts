import { describe, expect, it } from 'vitest'
import type { ClipBounds } from '@/lib/clips/edits'
import { trimNeedsEditorWordsRefetch } from '@/lib/clips/editor-words-merge'
import type { SourceWord } from '@/lib/clips/source-words'

const bounds: ClipBounds = { clipStartMs: 10_000, clipEndMs: 40_000 }

function word(w: string, sSec: number, eSec: number, i: number): SourceWord {
  return { w, s: sSec, e: eSec, i }
}

describe('trimNeedsEditorWordsRefetch', () => {
  it('is false when trim stays inside loaded word span', () => {
    const words = [word('a', 12, 13, 0), word('b', 35, 36, 1)]
    expect(trimNeedsEditorWordsRefetch(words, { in: 12_000, out: 36_000 }, bounds)).toBe(false)
  })

  it('N5 does not refetch normal unextended trim just because a clip begins in silence', () => {
    const words = [word('mid', 15, 16, 0)]
    expect(trimNeedsEditorWordsRefetch(words, { in: 10_500, out: 16_000 }, bounds)).toBe(false)
    expect(trimNeedsEditorWordsRefetch(words, { in: 10_000, out: 40_000 }, bounds)).toBe(false)
  })

  it('does refetch a genuinely extended trim before the original clip start', () => {
    const words = [word('mid', 15, 16, 0)]
    expect(trimNeedsEditorWordsRefetch(words, { in: 9_500, out: 16_000 }, bounds)).toBe(true)
  })

  it('is true when trim extends after word coverage', () => {
    const words = [word('mid', 15, 16, 0)]
    expect(trimNeedsEditorWordsRefetch(words, { in: 15_000, out: 40_500 }, bounds)).toBe(true)
  })

  it('is false when trim is outside the legal extend window', () => {
    const words = [word('mid', 15, 16, 0)]
    expect(trimNeedsEditorWordsRefetch(words, { in: 0, out: 16_000 }, bounds)).toBe(false)
  })

  it('uses media trim bounds when set', () => {
    const words = [word('mid', 15, 16, 0)]
    const mediaBounds: ClipBounds = {
      ...bounds,
      trimMinMs: 12_000,
      trimMaxMs: 38_000,
    }
    expect(trimNeedsEditorWordsRefetch(words, { in: 11_500, out: 16_000 }, mediaBounds)).toBe(false)
    expect(trimNeedsEditorWordsRefetch(words, { in: 12_500, out: 16_000 }, mediaBounds)).toBe(false)
    expect(trimNeedsEditorWordsRefetch(words, { in: 10_000, out: 16_000 }, mediaBounds)).toBe(false)
  })
})
