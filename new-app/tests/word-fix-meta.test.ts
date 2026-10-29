import { describe, expect, it } from 'vitest'
import { normalizeEdits } from '@/lib/clips/edits'

describe('wordFixMeta normalize', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 10_000 }

  it('preserves meta for fixed words', () => {
    const edits = normalizeEdits(
      {
        wordFixes: { '3': 'Thursday' },
        wordFixMeta: { '3': { s: 4200, w: 'Tuesday' } },
      },
      bounds,
    )
    expect(edits.wordFixMeta?.['3']).toEqual({ s: 4200, w: 'Tuesday' })
  })

  it('drops orphan meta without fix', () => {
    const edits = normalizeEdits(
      {
        wordFixMeta: { '3': { s: 4200, w: 'Tuesday' } },
      },
      bounds,
    )
    expect(edits.wordFixMeta).toBeUndefined()
  })
})
