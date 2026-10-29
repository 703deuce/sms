import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { previewExportMatchesDefault } from '@/lib/clips/export-edits-match'
import { speechLevelingPatch } from '@/lib/clips/speech-leveling'

describe('loudness preview reuse guard', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 60000 }

  it('returns false when speech leveling is enabled', () => {
    const edits = normalizeEdits({ ...defaultEdits(bounds), ...speechLevelingPatch(true) }, bounds)
    expect(previewExportMatchesDefault(edits, bounds)).toBe(false)
  })

  it('returns false for speed export', () => {
    const edits = normalizeEdits({ ...defaultEdits(bounds), speed: 1.25 }, bounds)
    expect(previewExportMatchesDefault(edits, bounds)).toBe(false)
  })

  it('returns false for sectionOrder', () => {
    const edits = normalizeEdits(
      {
        ...defaultEdits(bounds),
        sectionOrder: [
          [30000, 60000],
          [0, 30000],
        ],
      },
      bounds,
    )
    expect(previewExportMatchesDefault(edits, bounds)).toBe(false)
  })
})
