import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits, outputDurationMs, type ClipEditsV2 } from '@/lib/clips/edits'
import { exportTimeMap, toExportMs } from '@/lib/clips/editor/export-time'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { orderedKeepSegments } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 20000 }

describe('TL transport / ruler clock parity', () => {
  it('export playhead ms matches timeline mapping after a seek (inserts push export time)', () => {
    const e = normalizeEdits(
      {
        ...defaultEdits(bounds),
        inserts: [{ id: 'g1', sourceId: 'gap', atSrcMs: 5000, durMs: 4000, audio: 'mute' }],
      },
      bounds,
    )
    const tb = timebaseFor(e)
    const tmap = exportTimeMap(tb.segs, e.inserts)
    const editMs = 7000
    const exportMs = toExportMs(tmap, editMs, 'end')
    expect(exportMs).toBe(editMs + 4000)
    expect(outputDurationMs(e) + tmap.totalMs).toBeGreaterThan(outputDurationMs(e))
    expect(orderedKeepSegments(e).length).toBeGreaterThan(0)
  })
})
