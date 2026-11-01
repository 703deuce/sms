import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { sourceMsToEditorMs } from '@/lib/clips/editor/source-ms-to-editor'

describe('sourceMsToEditorMs', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 60_000 }

  it('maps source inside trim', () => {
    const edits = normalizeEdits(defaultEdits(bounds), bounds)
    const tb = timebaseFor(edits)
    expect(sourceMsToEditorMs(tb, 10_000)).toEqual({ ms: 10_000, wasCut: false })
  })

  it('snaps when source is inside a cut', () => {
    const base = defaultEdits(bounds)
    const edits = normalizeEdits(
      {
        ...base,
        cutRanges: [[5000, 8000]],
      },
      bounds,
    )
    const tb = timebaseFor(edits)
    const r = sourceMsToEditorMs(tb, 6000)
    expect(r.wasCut).toBe(true)
    expect(r.ms).toBeGreaterThanOrEqual(0)
  })
})
