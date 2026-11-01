/** TC2c: overlays carried on main-track reorder (TL-15); cross-track crossfade (TL-49). */
import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { moveItems, rippleAnchoredItems } from '@/lib/clips/editor/clip-timeline'
import { moveVideoSegment } from '@/lib/clips/editor/timeline-edit-ops'
import { autoCrossfade } from '@/lib/clips/editor/auto-crossfade'
import { addTrack } from '@/lib/clips/editor/tracks'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import type { BrollItem } from '@/lib/clips/broll'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const base = (): ClipEditsV2 => ({ ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false })
const br = (id: string, a: number, b: number): BrollItem => ({ id, source: 'stock', assetId: id, startMs: a, endMs: b, inMs: 0 })
const ctx = (e: ClipEditsV2) => ({ edits: e, previewEdits: e })
const reorder = (e: ClipEditsV2, seg: string, before: string | null) => {
  const n = moveVideoSegment(ctx(e), seg, before)!
  return rippleAnchoredItems(e, n, editorPreviewEdits(e, []), editorPreviewEdits(n, []))
}

describe('TC2c TL-15 linkage on reorder', () => {
  it('an overlay moves with the main clip under its start and keeps its length', () => {
    const e = { ...base(), videoSplits: [5000, 10000], broll: [br('in', 1000, 3000), br('span', 4000, 7000), br('later', 12000, 14000)] }
    const r = reorder(e, 'seg:5000', 'seg:0') // [5-10] first, then [0-5], [10-20]
    const at = Object.fromEntries(r.broll!.map((b) => [b.id, [b.startMs, b.endMs]]))
    expect(at.in).toEqual([6000, 8000])
    expect(at.span).toEqual([9000, 12000]) // was squashed / split across blocks before; length kept
    expect(at.later).toEqual([12000, 14000])
  })
  it('link toggle off: overlays keep their time on reorder', () => {
    const e = { ...base(), videoSplits: [5000, 10000], timelineOpts: { rippleOverlays: false }, broll: [br('in', 1000, 3000)] } as ClipEditsV2
    expect(reorder(e, 'seg:5000', 'seg:0').broll![0]).toEqual(expect.objectContaining({ startMs: 1000, endMs: 3000 }))
  })
})

describe('TC2c TL-49 cross-track crossfade', () => {
  it('overlap with B-roll on another track fades only when cross-track is on', () => {
    let e: ClipEditsV2 = { ...base(), broll: [br('a', 0, 3000), br('b', 4000, 6000)] }
    const added = addTrack(e, 'overlay')!
    e = { ...added.edits, tracks: added.edits.tracks!.map((t) => (t.id === added.trackId ? { ...t, items: ['b'] } : t)) }
    const m = moveItems(ctx(e), [{ lane: 'broll', id: 'b' }], -1500)!
    expect(autoCrossfade(e, m, e, m, [{ lane: 'broll', id: 'b' }]).keyframes).toBeUndefined()
    const x = autoCrossfade(e, m, e, m, [{ lane: 'broll', id: 'b' }], undefined, true)
    const fades = (x.keyframes ?? []).filter((k) => k.prop === 'opacity')
    expect(fades).toHaveLength(1)
    expect(fades[0]!.points.map((p) => p.v)).toEqual(fades[0]!.target === 'broll:b' ? [0, 100] : [100, 0])
  })
})
