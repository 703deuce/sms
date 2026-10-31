import { describe, expect, it } from 'vitest'
import {
  applyTimelineLaneState,
  buildTimelineItems,
  deleteItems,
  moveItems,
  rippleAnchoredItems,
  setLaneState,
  splitAt,
  trimItem,
  type OpCtx,
} from '@/lib/clips/editor/clip-timeline'
import {
  defaultEdits,
  displayDurationMs,
  editsPayloadForSave,
  isDefaultEdits,
  normalizeEdits,
  type ClipEditsV2,
} from '@/lib/clips/edits'
import { findTrack, reconcileItemMotion, targetForItem, targetOriginMs } from '@/lib/clips/editor/keyframes'
import { newTextItem, normalizeTextItems, textDisplay, TEXT_MAX_ITEMS, TEXT_MIN_MS, TEXT_PRESETS } from '@/lib/clips/editor/text-items'
import {
  applyLook,
  COLOR_PRESET_IDS,
  isIdentitySpec,
  lookForSpec,
  normalizeColorEdits,
  setBrollLook,
  setSegmentLook,
  setVideoLook,
  videoSpecAtSource,
} from '@/lib/clips/editor/color'
import {
  atempoChain,
  normalizeSegmentSpeeds,
  setSegmentSpeed,
  speedAtSource,
  speedWarpPieces,
  unwarpMs,
  warpedDurationMs,
  warpMs,
} from '@/lib/clips/editor/speed'
import {
  applyStarterLook,
  captionPresetPatch,
  captionStyleOptions,
  STARTER_LOOKS,
  templateInventory,
  templateLayoutPatch,
} from '@/lib/clips/editor/starter-templates'
import { T6_TEMPLATES, T6_TEMPLATES_BY_ID } from '@/lib/clips/templates/registry'
import { formatToolCost, producerToolCost } from '@/lib/clips/producer-cost'

const bounds = { clipStartMs: 0, clipEndMs: 10000, trimMinMs: 0, trimMaxMs: 20000 }
function base(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return { ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false, ...patch }
}
const ctxOf = (edits: ClipEditsV2): OpCtx => ({ edits, previewEdits: edits })
const T1 = { ...newTextItem('t1', 1000, 10000, 'basic', 'Hello'), endMs: 3000 }

describe('E4 text items model', () => {
  it('normalizes: min length, clamp to clip, id regex, blank text, cap', () => {
    const out = normalizeTextItems(
      [
        { id: 'a', text: 'x', startMs: 9900, endMs: 9950 },
        { id: 'bad id', text: 'x', startMs: 0, endMs: 1000 },
        { id: 'b', text: '   ', startMs: 0, endMs: 1000 },
        { id: 'c', text: 'ok', startMs: -50, endMs: 50 },
      ],
      10000,
    )!
    expect(out.map((t) => t.id)).toEqual(['c', 'a'])
    expect(out[0]).toMatchObject({ startMs: 0, endMs: TEXT_MIN_MS })
    expect(out[1]).toMatchObject({ startMs: 10000 - TEXT_MIN_MS, endMs: 10000 })
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `t${i}`, text: 'x', startMs: i, endMs: i + 500 }))
    expect(normalizeTextItems(many)!.length).toBe(TEXT_MAX_ITEMS)
  })

  it('new item at the playhead uses the preset; upper case display', () => {
    const it0 = newTextItem('n', 9800, 10000, 'title_white_on_black')
    expect(it0.endMs).toBe(10000)
    expect(it0.startMs).toBe(10000 - TEXT_MIN_MS)
    expect(textDisplay({ text: 'hey', style: { ...it0.style, case: 'upper' } })).toBe('HEY')
    expect(TEXT_PRESETS.slice(0, 4).every((p) => p.id.startsWith('title_'))).toBe(true)
  })

  it('round-trips through normalizeEdits and clears with null on save', () => {
    const e = normalizeEdits({ ...base(), textItems: [T1] }, bounds)
    expect(e.textItems?.[0]).toMatchObject({ id: 't1', startMs: 1000, endMs: 3000 })
    expect(isDefaultEdits(e, bounds)).toBe(false)
    const cleared = editsPayloadForSave({ ...e, textItems: undefined })
    expect(cleared.textItems).toBeNull()
  })
})

describe('E4 text lane ops', () => {
  const kf = [{ target: 'text:t1' as const, prop: 'x' as const, points: [{ tMs: 0, v: 0 }, { tMs: 1000, v: 20 }] }]
  const e = base({ textItems: [T1], keyframes: kf })

  it('lists text items on the Text lane with full caps', () => {
    const lanes = buildTimelineItems({ edits: e, previewEdits: e })
    const t = lanes.text.find((i) => i.id === 't1')!
    expect(t).toMatchObject({ startMs: 1000, endMs: 3000, label: 'Hello' })
    expect(t.caps).toMatchObject({ move: true, trimStart: true, trimEnd: true, split: true, del: true })
    expect(targetForItem('text', 't1')).toBe('text:t1')
    expect(targetForItem('text', 'hook')).toBe('text')
    expect(targetOriginMs(e, 'text:t1')).toBe(1000)
  })

  it('move carries the item (keyframes stay item-local)', () => {
    const next = moveItems(ctxOf(e), [{ lane: 'text', id: 't1' }], 500)!
    expect(next.textItems![0]).toMatchObject({ startMs: 1500, endMs: 3500 })
    const out = reconcileItemMotion(e, next)
    expect(findTrack(out, 'text:t1', 'x')!.points.map((p) => p.tMs)).toEqual([0, 1000])
  })

  it('left trim keeps keyframes on the frame content', () => {
    const next = trimItem(ctxOf(e), { lane: 'text', id: 't1' }, 'start', 1400)!
    expect(next.textItems![0]!.startMs).toBe(1400)
    const out = reconcileItemMotion(e, next)
    expect(findTrack(out, 'text:t1', 'x')!.points.map((p) => p.tMs)).toEqual([-400, 600])
  })

  it('trim respects TEXT_MIN_MS', () => {
    const next = trimItem(ctxOf(e), { lane: 'text', id: 't1' }, 'end', 1001)!
    expect(next.textItems![0]!.endMs - next.textItems![0]!.startMs).toBeGreaterThanOrEqual(TEXT_MIN_MS)
  })

  it('split makes two items; the right child inherits shifted keyframes', () => {
    const next = splitAt(ctxOf(e), [{ lane: 'text', id: 't1' }], 2000)!
    expect(next.textItems!.length).toBe(2)
    const [l, r] = next.textItems!
    expect(l).toMatchObject({ id: 't1', startMs: 1000, endMs: 2000 })
    expect(r!.startMs).toBe(2000)
    expect(r!.endMs).toBe(3000)
    const out = reconcileItemMotion(e, next)
    expect(findTrack(out, `text:${r!.id}`, 'x')).toBeTruthy()
    // The child id (`t1~2000`) survives normalize (save / reload).
    expect(normalizeEdits(out, bounds).textItems!.map((x) => x.id)).toEqual(['t1', r!.id])
  })

  it('E2fix Video splits: each half gets its own speed / color (source-anchored)', () => {
    const s = base({ videoSplits: [4000] })
    const halves = buildTimelineItems({ edits: s, previewEdits: s }).video
    expect(halves.map((h) => [h.srcInMs, h.srcOutMs])).toEqual([[0, 4000], [4000, 10000]])
    const sped = { ...s, segmentSpeeds: setSegmentSpeed(undefined, 4000, 10000, 2) }
    expect(displayDurationMs(sped)).toBe(7000)
    const looked = { ...s, color: setSegmentLook(undefined, 0, 4000, { preset: 'warm' }) }
    expect(videoSpecAtSource(looked.color, 3999)?.preset).toBe('warm')
    expect(videoSpecAtSource(looked.color, 4000)).toBeUndefined()
  })

  it('delete drops the item and its keyframes', () => {
    const next = deleteItems(ctxOf(e), [{ lane: 'text', id: 't1' }])!
    expect(next.textItems ?? []).toEqual([])
    expect(reconcileItemMotion(e, next).keyframes ?? []).toEqual([])
  })

  it('hidden Text lane drops text items from the render edits', () => {
    const hidden = setLaneState(e, 'text', { hidden: true })
    expect(applyTimelineLaneState(hidden).textItems ?? []).toEqual([])
  })

  it('ripples with a cut before it (like B-roll)', () => {
    const cut = { ...e, cutRanges: [[0, 500]] as [number, number][] }
    const out = rippleAnchoredItems(e, cut, e, cut)
    expect(out.textItems![0]).toMatchObject({ startMs: 500, endMs: 2500 })
  })
})

describe('E4 color model', () => {
  it('identity and presets', () => {
    expect(isIdentitySpec({})).toBe(true)
    expect(isIdentitySpec({ preset: 'vivid', intensity: 0 })).toBe(true)
    const px: [number, number, number] = [0.6, 0.4, 0.3]
    const outs = COLOR_PRESET_IDS.map((id) => applyLook(lookForSpec({ preset: id }), px).map((v) => v.toFixed(3)).join())
    expect(new Set(outs).size).toBe(COLOR_PRESET_IDS.length)
    const bw = applyLook(lookForSpec({ preset: 'bw' }), px)
    expect(Math.abs(bw[0] - bw[1])).toBeLessThan(1e-6)
  })

  it('segment looks are source-anchored and override the whole-video look', () => {
    let c = setVideoLook(undefined, { preset: 'warm' })
    c = setSegmentLook(c, 2000, 4000, { preset: 'cool' })
    expect(videoSpecAtSource(c, 1000)?.preset).toBe('warm')
    expect(videoSpecAtSource(c, 3000)?.preset).toBe('cool')
    c = setVideoLook(c, { preset: 'bw' }, true)
    expect(videoSpecAtSource(c, 3000)?.preset).toBe('bw')
    expect(c?.segments).toBeUndefined()
  })

  it('B-roll looks are per id; unknown ids are dropped on normalize', () => {
    const c = setBrollLook(undefined, 'b1', { preset: 'film' })
    expect(normalizeColorEdits(c, new Set(['b1']))?.broll?.b1?.preset).toBe('film')
    expect(normalizeColorEdits(c, new Set(['b2']))).toBeUndefined()
  })
})

describe('E4 speed model', () => {
  it('sets / replaces / clears a range', () => {
    let s = setSegmentSpeed(undefined, 1000, 3000, 2)
    expect(s).toEqual([{ fromMs: 1000, toMs: 3000, speed: 2 }])
    s = setSegmentSpeed(s, 2000, 4000, 0.5)
    expect(speedAtSource(s, 1500)).toBe(2)
    expect(speedAtSource(s, 2500)).toBe(0.5)
    expect(setSegmentSpeed(setSegmentSpeed(undefined, 0, 1000, 2), 0, 1000, 1)).toBeUndefined()
    expect(normalizeSegmentSpeeds([{ fromMs: 0, toMs: 100, speed: 9 }])?.[0]?.speed).toBe(4)
  })

  it('warp pieces, warp / unwarp inverse, duration', () => {
    const pieces = speedWarpPieces([[0, 4000]], [{ fromMs: 1000, toMs: 3000, speed: 2 }])
    expect(pieces).toEqual([
      { startMs: 0, endMs: 1000, speed: 1 },
      { startMs: 1000, endMs: 3000, speed: 2 },
      { startMs: 3000, endMs: 4000, speed: 1 },
    ])
    expect(warpedDurationMs(pieces)).toBe(3000)
    for (const t of [0, 500, 1000, 2000, 3500, 4000]) expect(unwarpMs(pieces, warpMs(pieces, t))).toBeCloseTo(t, 6)
    const e = base({ segmentSpeeds: [{ fromMs: 0, toMs: 10000, speed: 2 }] })
    expect(displayDurationMs(e)).toBe(5000)
  })

  it('atempo chain stays within [0.5, 2] and multiplies to the speed', () => {
    for (const s of [0.25, 0.3, 0.75, 1.5, 3, 4]) {
      const c = atempoChain(s)
      expect(c.every((f) => f >= 0.5 && f <= 2)).toBe(true)
      expect(c.reduce((a, b) => a * b, 1)).toBeCloseTo(s, 5)
    }
  })
})

describe('E4 templates (existing first)', () => {
  it('inventory counts the existing assets', () => {
    expect(T6_TEMPLATES.length).toBe(21)
    expect(templateInventory(true, true)).toMatchObject({ layouts: 21, captionStyles: 21, textStyles: TEXT_PRESETS.length })
    expect(templateInventory(false, false)).toMatchObject({ layouts: 8, captionStyles: 10 })
    expect(captionStyleOptions(false).every((o) => o.kind === 'classic')).toBe(true)
  })

  it('caption patch: classic sets animation, CP keeps size/position only', () => {
    const e = base()
    const c = captionPresetPatch(e, 'karaoke')
    expect(c.captions.presetId).toBe('karaoke')
    const cp = captionPresetPatch(e, 'cp3')
    expect(cp.captions.presetId).toBe('cp3')
    expect(captionPresetPatch(e, 'nope')).toBe(e)
  })

  it('layout patch matches the Layout panel template tile', () => {
    const t = T6_TEMPLATES_BY_ID.G1!
    const out = templateLayoutPatch(base(), t, { auto: false, reason: 'user_pick', family: 'gaming' })
    expect(out.layout.template).toMatchObject({ id: 'G1', auto: false, lane: 'gaming' })
    expect(out.layout.userPicked).toBe(true)
  })

  it('starter look = one edit; re-applying replaces the starter title', () => {
    let n = 0
    const opts = { t6Templates: true, t6Captions: true, durationMs: 10000, newId: () => `s${++n}` }
    const look = STARTER_LOOKS.find((l) => l.id === 'cinematic')!
    const a = applyStarterLook(base(), look, opts)
    expect(a.layout.template?.id).toBe('I1')
    expect(a.captions.presetId).toBe('cp9')
    expect(a.color?.video?.preset).toBe('teal_orange')
    expect(a.textItems?.length).toBe(1)
    const b = applyStarterLook(a, STARTER_LOOKS.find((l) => l.id === 'podcast_clean')!, opts)
    expect(b.textItems?.length).toBe(1)
    expect(b.color?.video).toBeUndefined()
    const off = applyStarterLook(base(), look, { ...opts, t6Templates: false, t6Captions: false })
    expect(off.layout.mode).toBe('fit_blur')
    expect(off.captions.presetId).toBe('minimal')
  })
})

describe('E4 producer cost', () => {
  it('free edits vs paid tools', () => {
    expect(formatToolCost(producerToolCost({ name: 'set_captions' }, 30000))).toBe('Free · 0 credits')
    const m = producerToolCost({ name: 'generate_music' }, 30000)
    expect(m).toMatchObject({ paid: true, credits: 2 })
    expect(producerToolCost({ name: 'generate_thumbnail' }, 1)).toMatchObject({ credits: 3, usd: 0.18 })
    expect(producerToolCost({ name: 'dub' }, 90_000).credits).toBe(12)
    // EP1g: credits only — the provider $ estimate is never shown to users.
    expect(formatToolCost(m)).toBe('2 credits')
    expect(formatToolCost(producerToolCost({ name: 'dub' }, 90_000))).toBe('12 credits')
  })
})
