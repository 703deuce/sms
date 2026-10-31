import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits, editsPayloadForSave, isDefaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { rippleAnchoredItems, splitAt, timebaseFor } from '@/lib/clips/editor/clip-timeline'
import {
  adjacentKeyframe,
  deleteKeyframesAt,
  findTrack,
  keyframeTimes,
  layerTransformAt,
  moveKeyframesAt,
  reconcileItemMotion,
  setKeyframeEase,
  setPropertyAt,
  toggleKeyframeAt,
  trackValueAt,
  valueAtPoints,
} from '@/lib/clips/editor/keyframes'
import {
  applyCutTransitionToAll,
  brollTransitionWindows,
  compositeCss,
  cutTransitionWindows,
  remapCutTransitions,
  setBrollTransition,
  setCutTransition,
  transitionFrame,
  TRANSITION_TYPES,
} from '@/lib/clips/editor/transitions'
import { brollFrame, hookFrame, mainFrame } from '@/lib/clips/editor/motion-frame'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const base = (patch: Partial<ClipEditsV2> = {}): ClipEditsV2 => ({
  ...normalizeEdits(defaultEdits(bounds), bounds),
  loopFriendlyEnd: false,
  ...patch,
})

describe('keyframe math', () => {
  it('holds before / after, eases per segment from the left point', () => {
    const pts = [
      { tMs: 1000, v: 0, ease: 'in' as const },
      { tMs: 2000, v: 100, ease: 'out' as const },
      { tMs: 3000, v: 0 },
    ]
    expect(valueAtPoints(pts, 0, 50)).toBe(0)
    expect(valueAtPoints(pts, 1500, 50)).toBeCloseTo(25) // in: u²
    expect(valueAtPoints(pts, 2500, 50)).toBeCloseTo(25) // out: 100 − 100·(1−(1−u)²) at u=.5 → 25
    expect(valueAtPoints(pts, 9999, 50)).toBe(0)
  })
})

describe('keyframe ops (CapCut ◇ semantics)', () => {
  it('◇ adds a keyframe with the current value; a second press removes it and keeps the look', () => {
    let e = base()
    e = setPropertyAt(e, 'video', 'scale', 0, 150) // no keyframes → static value
    expect(findTrack(e, 'video', 'scale')).toMatchObject({ value: 150, points: [] })
    e = toggleKeyframeAt(e, 'video', 'scale', 1000)
    expect(findTrack(e, 'video', 'scale')!.points).toEqual([{ tMs: 1000, v: 150 }])
    // Editing a value with keyframes present auto-keys at the playhead.
    e = setPropertyAt(e, 'video', 'scale', 3000, 50)
    expect(keyframeTimes(e, 'video')).toEqual([1000, 3000])
    expect(trackValueAt(findTrack(e, 'video', 'scale'), 'scale', 2000)).toBe(100)
    e = setKeyframeEase(e, 'video', 'scale', 1000, 'inOut')
    expect(findTrack(e, 'video', 'scale')!.points[0]!.ease).toBe('inOut')
    expect(adjacentKeyframe(e, 'video', null, 1000, 1)).toBe(3000)
    expect(adjacentKeyframe(e, 'video', null, 2000, -1)).toBe(1000)
    e = moveKeyframesAt(e, 'video', 3000, 2500)
    expect(keyframeTimes(e, 'video')).toEqual([1000, 2500])
    e = deleteKeyframesAt(e, 'video', 2500)
    e = toggleKeyframeAt(e, 'video', 'scale', 1000)
    expect(findTrack(e, 'video', 'scale')).toMatchObject({ value: 150, points: [] })
    e = setPropertyAt(e, 'video', 'scale', 0, 100)
    expect(e.keyframes).toBeUndefined()
  })

  it('values clamp to the property range', () => {
    const e = setPropertyAt(base(), 'video', 'opacity', 0, 180)
    expect(layerTransformAt(e, 'video', 0).opacity).toBe(100)
  })

  it('persists, clears with null, and disables preview reuse', () => {
    const e = toggleKeyframeAt(base(), 'voice', 'volume', 500)
    expect(isDefaultEdits(e, bounds)).toBe(false)
    expect(isDefaultEdits(setCutTransition(base(), 3000, { type: 'crossfade', durMs: 400 }), bounds)).toBe(false)
    expect(editsPayloadForSave(base()).keyframes).toBeNull()
    expect(editsPayloadForSave(base()).transitions).toBeNull()
    const round = normalizeEdits(JSON.parse(JSON.stringify(e)), bounds)
    expect(round.keyframes).toEqual(e.keyframes)
  })
})

describe('keyframes stay on their content', () => {
  const withBroll = () =>
    base({
      broll: [{ id: 'b1', source: 'stock', assetId: 'a', startMs: 2000, endMs: 6000, transitionIn: { type: 'crossfade', durMs: 300 }, transitionOut: { type: 'blur', durMs: 300 } }],
      keyframes: [{ target: 'broll:b1', prop: 'x', points: [{ tMs: 1000, v: 10 }, { tMs: 3000, v: 30 }] }],
    })

  it('left-trim shifts item-local keyframes by the in-point change', () => {
    const prev = withBroll()
    const next = { ...prev, broll: [{ ...prev.broll![0]!, startMs: 2500, inMs: 500 }] }
    const out = reconcileItemMotion(prev, next)
    expect(findTrack(out, 'broll:b1', 'x')!.points.map((p) => p.tMs)).toEqual([500, 2500])
  })

  it('split copies keyframes to the right half and splits edge transitions', () => {
    const prev = withBroll()
    const pe = prev
    const next = splitAt({ edits: prev, previewEdits: pe, clampTrim: (t) => t }, [{ lane: 'broll', id: 'b1' }], 4000)!
    const out = rippleAnchoredItems(prev, next, pe, next)
    const right = out.broll!.find((b) => b.id !== 'b1')!
    expect(findTrack(out, `broll:${right.id}`, 'x')!.points.map((p) => p.tMs)).toEqual([-1000, 1000])
    expect(out.broll!.find((b) => b.id === 'b1')!.transitionOut).toBeUndefined()
    expect(right.transitionIn).toBeUndefined()
    expect(right.transitionOut?.type).toBe('blur')
  })

  it('deleting the item drops its tracks', () => {
    const prev = withBroll()
    const out = reconcileItemMotion(prev, { ...prev, broll: [] })
    expect(out.keyframes).toBeUndefined()
  })

  it('a transcript cut ripples Video keyframes with their source content; transitions follow their cut', () => {
    const prev = base({
      cutRanges: [[3000, 4000]],
      keyframes: [{ target: 'video', prop: 'x', points: [{ tMs: 5000, v: 20 }] }],
      transitions: [{ srcMs: 4000, type: 'crossfade', durMs: 400 }],
    })
    // Extend the cut: 3000–4500 → the joint moves to source 4500, output 3000.
    const next = { ...prev, cutRanges: [[3000, 4500]] as [number, number][] }
    const out = rippleAnchoredItems(prev, next, prev, next)
    expect(findTrack(out, 'video', 'x')!.points[0]!.tMs).toBe(4500)
    expect(out.transitions).toEqual([{ srcMs: 4500, type: 'crossfade', durMs: 400 }])
  })

  it('remapCutTransitions drops transitions whose cut disappeared', () => {
    expect(remapCutTransitions([{ srcMs: 4000, type: 'blur', durMs: 400 }], [[0, 3000], [4000, 9000]], [[0, 9000]])).toBeUndefined()
  })
})

describe('transitions', () => {
  it('windows are centred on the cut, clamped by the shorter clip, frame-aligned', () => {
    const tb = timebaseFor(base({ cutRanges: [[3000, 4000]] }))
    const [w] = cutTransitionWindows(tb.segs, tb.starts, [{ srcMs: 4000, type: 'dip_black', durMs: 500 }])
    expect(w).toMatchObject({ cutMs: 3000, startFrame: 83, frames: 15, aEnd: 3000, bStart: 4000 })
    expect(w!.w0Ms).toBeCloseTo(2766.667, 2) // round(82.5) = 83 (half up, same in motion.py)
  })

  it('composite CSS reproduces the xfade blend weights for every type and stacking', () => {
    for (const t of TRANSITION_TYPES) {
      for (const q of [0, 0.13, 0.5, 0.77, 1]) {
        const f = transitionFrame(t, q)
        expect(f.wA + f.wB + f.wC).toBeCloseTo(f.geometric ? 2 : 1, 9)
        if (f.geometric) continue
        for (const aTop of [true, false]) {
          const css = compositeCss(f, aTop, 400)
          const top = aTop ? css.a.opacity : css.b.opacity
          const c = css.color.opacity
          const effTop = top
          const effColor = (1 - top) * c
          const effBottom = (1 - top) * (1 - c)
          expect(effTop).toBeCloseTo(aTop ? f.wA : f.wB, 4)
          expect(effColor).toBeCloseTo(f.wC, 4)
          expect(effBottom).toBeCloseTo(aTop ? f.wB : f.wA, 4)
        }
      }
    }
  })

  it('wipe clip is complemented when A is the top layer', () => {
    const f = transitionFrame('wipe_left', 0.25)
    expect(compositeCss(f, false, 100).b.clipPath).toBe('inset(0% 0% 0% 75%)')
    expect(compositeCss(f, true, 100).a.clipPath).toBe('inset(0% 25% 0% 0%)')
  })

  it('apply to all / B-roll edges / between', () => {
    const tb = timebaseFor(base({ cutRanges: [[3000, 4000], [8000, 9000]] }))
    const e = applyCutTransitionToAll(base(), tb.segs, { type: 'push_left', durMs: 300 })
    expect(e.transitions!.map((t) => t.srcMs)).toEqual([4000, 9000])
    let b = base({
      broll: [
        { id: 'a', source: 'stock', assetId: 'x', startMs: 1000, endMs: 2000 },
        { id: 'b', source: 'stock', assetId: 'y', startMs: 2000, endMs: 4000 },
      ],
    })
    b = setBrollTransition(b, 'b', 'in', { type: 'wipe_up', durMs: 400 })
    b = setBrollTransition(b, 'a', 'out', { type: 'blur', durMs: 400 })
    const ws = brollTransitionWindows(b.broll)
    // a's out is superseded by b's 'between' transition (CapCut: one transition per joint).
    expect(ws).toEqual([expect.objectContaining({ itemId: 'b', kind: 'between', fromId: 'a', startFrame: 60, frames: 12 })])
  })
})

describe('preview frame styles (motion-frame)', () => {
  it('cut window: clone source times are the export handle frames', () => {
    const e = base({ cutRanges: [[3000, 4000]], transitions: [{ srcMs: 4000, type: 'crossfade', durMs: 400 }] })
    const tb = timebaseFor(e)
    const at = mainFrame(e, tb, 2900, 360)
    expect(at.cut).not.toBeNull()
    expect(at.cut!.aSrcMs).toBe(2900) // A continued: aEnd + (t − cut)
    expect(at.cut!.bSrcMs).toBe(3900) // B pre-rolled: bStart + (t − cut)
    expect(mainFrame(e, tb, 2000, 360).upcoming).not.toBeNull()
    expect(mainFrame(e, tb, 5000, 360).cut).toBeNull()
  })

  it('between window: previous item is the bottom layer, item fades in on top', () => {
    const e = base({
      broll: [
        { id: 'a', source: 'stock', assetId: 'x', startMs: 1000, endMs: 2000 },
        { id: 'b', source: 'stock', assetId: 'y', startMs: 2000, endMs: 4000, transitionIn: { type: 'crossfade', durMs: 400 } },
      ],
    })
    const f = brollFrame(e, 2200, 360)
    expect(f.items.a!.box).not.toBeNull() // continues through the window
    expect(f.items.b!.box!.opacity).toBeCloseTo(0.5, 1)
    expect(brollFrame(e, 2500, 360).items.a!.box).toBeNull()
  })

  it('hook: ASS fade folded into opacity, keyframed transform', () => {
    const e = base({
      hookOverlay: { enabled: true, text: 'Hi', durationMs: 2000 },
      keyframes: [{ target: 'text', prop: 'x', points: [{ tMs: 0, v: 0 }, { tMs: 1000, v: 20 }] }],
    })
    expect(hookFrame(e, 90)!.opacity).toBeCloseTo(0.5)
    expect(hookFrame(e, 500)!.transform).toContain('translate(10%, 0%)')
    expect(hookFrame(e, 2100)).toBeNull()
  })
})
