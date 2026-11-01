/** TR batch 1: TR-04 cut-only transitions, TR-05 cross-track crossfade, TR-06 clone grading hooks. */
import { describe, expect, it, vi } from 'vitest'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import type { BrollItem } from '@/lib/clips/broll'
import { autoCrossfade } from '@/lib/clips/editor/auto-crossfade'
import { moveItems } from '@/lib/clips/editor/clip-timeline'
import { brollFrame } from '@/lib/clips/editor/motion-frame'
import { ensureClone, syncClone } from '@/components/clips/editor/motion-preview'
import { orderedStack } from '@/lib/clips/editor/layer-props'
import { addTrack } from '@/lib/clips/editor/tracks'
import {
  brollTransitionWindows,
  CUT_ONLY_TRANSITIONS,
  G4B_MASK_TRANSITION_TYPES,
  MASK_TRANSITIONS,
  transitionFrame,
  TRANSITION_TYPES,
} from '@/lib/clips/editor/transitions'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const br = (id: string, a: number, b: number): BrollItem => ({ id, source: 'stock', assetId: id, startMs: a, endMs: b, inMs: 0 })

describe('TR-04 transitions', () => {
  it('MASK_TRANSITIONS is the explicit 23-type G4b set', () => {
    expect([...MASK_TRANSITIONS].sort()).toEqual([...G4B_MASK_TRANSITION_TYPES].sort())
    for (const t of CUT_ONLY_TRANSITIONS) expect(MASK_TRANSITIONS.has(t)).toBe(false)
  })

  it('fade_grays sat and weights at P=.9 and .3', () => {
    const atP = (P: number) => transitionFrame('fade_grays', 1 - P)
    const f9 = atP(0.9)
    expect(f9.wA).toBeCloseTo(0.9, 5)
    expect(f9.wB).toBeCloseTo(0.1, 5)
    const s1 = 0.5 // smoothstep(0.8, 1, 0.9)
    const s2_9 = 0.95703125 // smoothstep(0.2, 1, 0.9)
    expect(f9.satA).toBeCloseTo(s1, 5)
    expect(f9.satB).toBeCloseTo(1 - s2_9, 5)
    const f3 = atP(0.3)
    const s2_3 = 0.04296875
    expect(f3.satB).toBeCloseTo(1 - s2_3, 5)
  })

  it('pixelize blockFrac and none at edges', () => {
    const mid = transitionFrame('pixelize', 0.5)
    expect(mid.pixel).toEqual({ blockFrac: 0.05, P: 0.5 })
    const edge = transitionFrame('pixelize', 0.02)
    expect(edge.pixel?.blockFrac).toBeCloseTo(0.004, 5)
    expect(transitionFrame('pixelize', 0).pixel).toBeUndefined()
    expect(transitionFrame('pixelize', 1).pixel).toBeUndefined()
  })

  it('cover / reveal / squeeze geometry', () => {
    const cover = transitionFrame('cover_left', 0.25)
    expect(cover.b.tx).toBeCloseTo(0.75, 5)
    expect(cover.top).toBe('b')
    const rev = transitionFrame('reveal_up', 0.25)
    expect(rev.a.ty).toBeCloseTo(-0.25, 5)
    expect(rev.top).toBe('a')
    const sq = transitionFrame('squeeze_h', 0.4)
    expect(sq.a.sy).toBeCloseTo(0.6, 5)
    expect(sq.top).toBe('a')
  })

  it('brollTransitionWindows skips cut-only types', () => {
    const items = [
      {
        ...br('x', 0, 2000),
        transitionIn: { type: 'pixelize' as const, durMs: 400 },
        transitionOut: { type: 'cover_left' as const, durMs: 400 },
      },
    ] as BrollItem[]
    expect(brollTransitionWindows(items)).toHaveLength(0)
  })

  it('first 37 transition types still in TRANSITION_TYPES order', () => {
    const legacy = TRANSITION_TYPES.slice(0, 37)
    expect(legacy).toHaveLength(37)
    expect(transitionFrame('crossfade', 0.5).wA).toBeCloseTo(0.5, 5)
  })
})

describe('TR-05 cross-track crossfade parity samples', () => {
  it('opacity envelope on the stacked-top B-roll item', () => {
    let e: ClipEditsV2 = { ...normalizeEdits(defaultEdits(bounds), bounds), broll: [br('a', 0, 4000), br('b', 5000, 7000)] }
    const added = addTrack(e, 'overlay')!
    e = {
      ...added.edits,
      tracks: added.edits.tracks!.map((t) => (t.id === added.trackId ? { ...t, items: ['b'] } : t)),
    }
    const m = moveItems({ edits: e, previewEdits: e }, [{ lane: 'broll', id: 'b' }], -1600)!
    const x = autoCrossfade(e, m, e, m, [{ lane: 'broll', id: 'b' }], undefined, true)
    const stack = orderedStack(x, 'broll', x.broll ?? [])
    const topId = stack[stack.length - 1]!.id
    const fades = (x.keyframes ?? []).filter((k) => k.prop === 'opacity')
    expect(fades).toHaveLength(1)
    expect(fades[0]!.target).toBe(`broll:${topId}`)
    const startMs = 3400
    const endMs = 4000
    const midMs = 3700
    for (const [t, want] of [
      [startMs, 0],
      [midMs, 0.5],
      [endMs, 1],
    ] as const) {
      const op = brollFrame(x, t, 360).items[topId]?.box?.opacity ?? -1
      expect(Math.abs(op - want)).toBeLessThanOrEqual(1e-6)
    }
  })
})

// @vitest-environment happy-dom
describe('TR-06 gradeClone / ensureClone', () => {
  it('syncClone with gradeClone does not set style.filter', () => {
    const host = document.createElement('div')
    const main = document.createElement('div')
    const v = document.createElement('video')
    main.appendChild(v)
    host.appendChild(main.cloneNode(true))
    syncClone(host, main, 0, 0, false, 1, 'blur(1px)', () => true)
    expect(v.style.filter).toBe('')
  })

  it('ensureClone strips cloned GL mirror canvases', () => {
    const host = document.createElement('div')
    const main = document.createElement('div')
    const v = document.createElement('video')
    v.setAttribute('data-g4-src', '1')
    main.appendChild(v)
    const mirror = document.createElement('canvas')
    mirror.setAttribute('data-g4-mirror', '1')
    main.appendChild(mirror)
    ensureClone(host, main)
    expect(host.querySelector('canvas[data-g4-mirror]')).toBeNull()
    expect(host.querySelector('[data-g4-src="1"]')).toBeNull()
  })
})
