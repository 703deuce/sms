import { describe, expect, it } from 'vitest'
import { countProducerFieldChanges, captionsUnchanged } from '@/lib/clips/producer-diff'
import { defaultEdits } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 60_000 }

describe('producer-diff', () => {
  it('detects caption preset change', () => {
    const a = defaultEdits(bounds)
    const b = { ...a, captions: { ...a.captions, presetId: 'karaoke', animation: 'karaoke' } }
    expect(captionsUnchanged(a, b)).toBe(false)
    expect(countProducerFieldChanges(a, b)).toBe(1)
  })

  it('ignores identical captions', () => {
    const a = defaultEdits(bounds)
    expect(captionsUnchanged(a, a)).toBe(true)
    expect(countProducerFieldChanges(a, a)).toBe(0)
  })
})
