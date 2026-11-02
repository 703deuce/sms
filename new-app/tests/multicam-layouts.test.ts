import { describe, expect, it } from 'vitest'
import { defaultEdits } from '@/lib/clips/edits'
import { normalizeSegmentLayout } from '@/lib/clips/editor/segment-layout'
import { setLayoutForRange } from '@/lib/clips/editor/multicam-manual'
import { normalizeSourceSegments, type ClipMediaSource } from '@/lib/clips/editor/sources'

const library: ClipMediaSource[] = [
  { id: 'a1', ref: 'upload', refId: 'u1', mediaType: 'video', syncMs: 0 },
  { id: 'a2', ref: 'upload', refId: 'u2', mediaType: 'video', syncMs: 0 },
]

describe('multicam segment layouts', () => {
  it('normalize clamps and drops invalid layout', () => {
    expect(normalizeSegmentLayout({ kind: 'pip', withSourceId: 'a1' }, library, 'a1')).toBeUndefined()
    const ok = normalizeSegmentLayout({ kind: 'side_by_side', withSourceId: 'a2', split: 9 }, library, 'a1')
    expect(ok?.split).toBe(0.7)
  })

  it('setLayoutForRange attaches layout to active segment', () => {
    const bounds = { clipStartMs: 0, clipEndMs: 60_000 }
    let edits = defaultEdits(bounds)
    edits = {
      ...edits,
      sources: library,
      sourceSegments: [{ id: 's1', sourceId: 'a1', startMs: 0, endMs: 5000 }],
    }
    const next = setLayoutForRange(
      edits,
      1000,
      4000,
      { kind: 'side_by_side', withSourceId: 'a2', split: 0.5 },
      library,
    )
    const seg = normalizeSourceSegments(next.sourceSegments, library)?.[0]
    expect(seg?.layout?.kind).toBe('side_by_side')
  })

  it('segment without layout unchanged in normalize', () => {
    const segs = normalizeSourceSegments(
      [{ id: 's1', sourceId: 'a1', startMs: 0, endMs: 5000 }],
      library,
    )
    expect(segs?.[0]?.layout).toBeUndefined()
  })
})
