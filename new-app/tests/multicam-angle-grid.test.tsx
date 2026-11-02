import { describe, expect, it } from 'vitest'
import { defaultEdits } from '@/lib/clips/edits'
import { switchAngleAt, multicamAngles } from '@/lib/clips/editor/multicam-manual'

describe('multicam angle grid logic', () => {
  it('renders one tile per angle key up to 9', () => {
    const edits = defaultEdits({ clipStartMs: 0, clipEndMs: 60_000 })
    const library = [
      { id: 'a1', ref: 'upload' as const, refId: 'u1', mediaType: 'video' as const, syncMs: 0 },
      { id: 'a2', ref: 'upload' as const, refId: 'u2', mediaType: 'video' as const, syncMs: 0 },
    ]
    expect(multicamAngles(edits, library).length).toBe(3)
  })

  it('switchAngleAt adds a segment at playhead', () => {
    const edits = defaultEdits({ clipStartMs: 0, clipEndMs: 60_000 })
    const library = [{ id: 'a1', ref: 'upload' as const, refId: 'u1', mediaType: 'video' as const, syncMs: 0 }]
    const next = switchAngleAt({ ...edits, sources: library }, 2000, 'a1', library)
    expect(next.sourceSegments?.some((s) => s.sourceId === 'a1' && s.startMs === 2000)).toBe(true)
  })
})
