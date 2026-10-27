import { describe, expect, it } from 'vitest'
import { buildCaptionWords, type CaptionSourceWord } from '@/lib/clips/caption-words'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { clampTrimToExtendedBounds } from '@/lib/clips/trim-bounds'

describe('caption trim extend', () => {
  const clipStartMs = 10_000
  const clipEndMs = 40_000
  const words: CaptionSourceWord[] = [
    { i: 0, w: 'Hello', s: 12, e: 12.4 },
    { i: 1, w: 'world', s: 12.4, e: 12.9 },
    { i: 2, w: 'Later', s: 25, e: 25.4 },
  ]

  function editsWithTrim(inMs: number, outMs: number): ClipEditsV2 {
    const base = defaultEdits({ clipStartMs, clipEndMs })
    return {
      ...base,
      trim: clampTrimToExtendedBounds(clipStartMs, clipEndMs, { in: inMs, out: outMs }),
    }
  }

  it('keeps highlight timing after extend-trim in', () => {
    const edits = editsWithTrim(clipStartMs - 2000, clipEndMs)
    const cap = buildCaptionWords(words, edits)
    const hello = cap.find((c) => c.text === 'Hello')
    expect(hello).toBeDefined()
    expect(hello!.s_ms).toBe(4000)
    expect(hello!.e_ms).toBeGreaterThan(hello!.s_ms)
  })

  it('shifts output timeline after tightening trim in', () => {
    const edits = editsWithTrim(clipStartMs + 3000, clipEndMs)
    const cap = buildCaptionWords(words, edits)
    const hello = cap.find((c) => c.text === 'Hello')
    expect(hello).toBeUndefined()
    const later = cap.find((c) => c.text === 'Later')
    expect(later).toBeDefined()
    expect(later!.s_ms).toBe(12_000)
  })
})
