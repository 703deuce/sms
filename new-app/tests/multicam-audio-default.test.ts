import { describe, expect, it } from 'vitest'
import { defaultEdits } from '@/lib/clips/edits'
import { normalizeMulticam } from '@/lib/clips/editor/sources'
import { setAngleForRange } from '@/lib/clips/editor/multicam-manual'

describe('multicam audioDefault', () => {
  it('normalize drops invalid audioDefault', () => {
    expect(normalizeMulticam({ audioDefault: 'nope' })?.audioDefault).toBeUndefined()
    expect(normalizeMulticam({ audioDefault: 'main' })?.audioDefault).toBe('main')
  })

  it('without audioDefault segment matches legacy (no audio field)', () => {
    const edits = defaultEdits({ clipStartMs: 0, clipEndMs: 60_000 })
    const src = {
      id: 'cam_b',
      ref: 'upload' as const,
      refId: 'up_b',
      mediaType: 'video' as const,
      syncMs: 0,
    }
    const next = setAngleForRange({ ...edits, sources: [src] }, 1000, 5000, 'cam_b')
    const seg = next.sourceSegments?.[0]
    expect(seg?.audio).toBeUndefined()
  })

  it("audioDefault 'main' sets segment audio", () => {
    const edits = defaultEdits({ clipStartMs: 0, clipEndMs: 60_000 })
    const src = {
      id: 'cam_b',
      ref: 'upload' as const,
      refId: 'up_b',
      mediaType: 'video' as const,
      syncMs: 0,
    }
    const next = setAngleForRange(
      { ...edits, sources: [src], multicam: { audioDefault: 'main' } },
      1000,
      5000,
      'cam_b',
    )
    expect(next.sourceSegments?.[0]?.audio).toBe('main')
  })
})
