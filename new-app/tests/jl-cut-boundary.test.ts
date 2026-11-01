import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { buildTimelineItems, timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { jlCutBoundarySrcMs } from '@/lib/clips/editor/trim-tools'

describe('jlCutBoundarySrcMs', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 31_520 }
  const edits = normalizeEdits({ ...defaultEdits(bounds), videoSplits: [4640, 29210] }, bounds)
  const tb = timebaseFor(edits)
  const lanes = buildTimelineItems({ edits, previewEdits: edits })

  it('uses nearest edge when a middle video clip is selected', () => {
    const at = jlCutBoundarySrcMs(tb, edits, lanes, 20_000, [{ lane: 'video', id: 'seg:4640' }])
    expect(at).toBe(29210)
  })

  it('uses start split when playhead is near clip 2 start', () => {
    const at = jlCutBoundarySrcMs(tb, edits, lanes, 4700, [])
    expect(at).toBe(4640)
  })
})
