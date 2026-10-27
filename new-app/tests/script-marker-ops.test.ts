import { describe, expect, it } from 'vitest'
import { applyMarkerCompositionOp } from '@/lib/clips/script-edl/marker-ops'
import { applyCompositionOp, emptyDocument } from '@/lib/clips/script-edl/ops'
import { youtubeChaptersText } from '@/lib/clips/script-editor/chapters-export'

describe('marker ops', () => {
  const base = emptyDocument(['w0', 'w1'])

  it('adds and updates markers via composition op', () => {
    let doc = applyCompositionOp(base, { type: 'add_marker', outMs: 1000, label: 'Intro' })
    expect(doc.markers).toHaveLength(1)
    doc = applyCompositionOp(doc, { type: 'update_marker', id: doc.markers![0].id, patch: { label: 'Setup' } })
    expect(doc.markers![0].label).toBe('Setup')
    doc = applyCompositionOp(doc, { type: 'delete_marker', id: doc.markers![0].id })
    expect(doc.markers).toHaveLength(0)
  })

  it('exports youtube chapter lines', () => {
    const doc = applyMarkerCompositionOp(base, { type: 'add_marker', outMs: 0, label: 'Start' })
    const text = youtubeChaptersText(doc)
    expect(text).toContain('0:00 Start')
  })
})
