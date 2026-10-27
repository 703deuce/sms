import { describe, expect, it } from 'vitest'
import { defaultEdits } from '@/lib/clips/edits'
import {
  dominantLayoutModeForTrim,
  setLayoutModeForSegmentAt,
  splitLayoutSegmentAt,
} from '@/lib/clips/layout-segments'

const bounds = { clipStartMs: 0, clipEndMs: 10_000 }

describe('layout segments', () => {
  it('splits segment at playhead', () => {
    const edits = defaultEdits(bounds)
    const next = splitLayoutSegmentAt(edits, 5000)
    expect(next.layout.layoutSegments?.length).toBe(2)
  })

  it('sets mode on active segment', () => {
    let edits = defaultEdits(bounds)
    edits = splitLayoutSegmentAt(edits, 4000)
    const next = setLayoutModeForSegmentAt(edits, 1000, 'split')
    const seg = next.layout.layoutSegments?.find((s) => s.startMs <= 1000 && s.endMs > 1000)
    expect(seg?.mode).toBe('split')
  })

  it('picks dominant layout for export window', () => {
    let edits = defaultEdits(bounds)
    edits = splitLayoutSegmentAt(edits, 3000)
    edits = setLayoutModeForSegmentAt(edits, 5000, 'fit_blur')
    expect(dominantLayoutModeForTrim(edits)).toBe('fit_blur')
  })
})
