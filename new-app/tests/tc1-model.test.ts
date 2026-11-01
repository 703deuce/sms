import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyTimelineLaneState,
  buildTimelineItems,
  deleteItems,
  replaceWithGaps,
  rippleAnchoredItems,
  splitAt,
  timebaseFor,
  type OpCtx,
} from '@/lib/clips/editor/clip-timeline'
import { defaultEdits, editsPayloadForSave, isDefaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import {
  adjacentMarker,
  chapterText,
  markerAt,
  normalizeMarkers,
  patchMarker,
  rippleMarkers,
  toggleMarkerAt,
  MAX_MARKERS,
} from '@/lib/clips/editor/markers'
import {
  applyItemEnable,
  expandToGroups,
  groupItems,
  groupOf,
  normalizeDisabledItems,
  normalizeGroups,
  reconcileItemFlags,
  toggleItemsEnabled,
  ungroupItems,
} from '@/lib/clips/editor/item-flags'
import { magnetOn, normalizeTimelineOpts, rippleOverlaysOn, setTimelineOpt } from '@/lib/clips/editor/timeline-opts'
import { addGapAt, insertWindows, isGapInsert, normalizeInserts, GAP_SOURCE_ID } from '@/lib/clips/editor/inserts'
import { capUnderPasses, normalizeTracks, MAX_UNDER_PASSES, MAX_VISUAL_TRACKS } from '@/lib/clips/editor/tracks'
import { getPreviewRate, setPreviewRate, stepPreviewRate, subscribePreviewRate } from '@/lib/clips/editor/preview-rate'

const bounds = { clipStartMs: 0, clipEndMs: 10000, trimMinMs: 0, trimMaxMs: 20000 }
function base(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return { ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false, ...patch }
}
const ctxOf = (edits: ClipEditsV2): OpCtx => ({ edits, previewEdits: edits })
const FX = JSON.parse(readFileSync(path.join(__dirname, '../../worker/tests/fixtures/tc1_parity.json'), 'utf8'))
const broll = (id: string, startMs: number, endMs: number) =>
  ({ id, source: 'upload', uploadId: 'u1', url: null, startMs, endMs }) as unknown as NonNullable<ClipEditsV2['broll']>[number]

describe('TC1 markers (TL-28)', () => {
  it('normalizes: valid ids, sorted, colors / labels / chapter cleaned, capped', () => {
    const got = normalizeMarkers([
      { id: 'b', ms: 5000.6, color: 'red', label: '  Big   reveal ', chapter: true },
      { id: 'a', ms: 1000, color: 'pink', label: '' },
      { id: 'a', ms: 2000 },
      { id: 'bad id', ms: 1 },
      { id: 'c', ms: -5 },
      'x',
    ])
    expect(got).toEqual([
      { id: 'a', ms: 1000, color: 'blue' },
      { id: 'b', ms: 5001, color: 'red', label: 'Big reveal', chapter: true },
    ])
    expect(normalizeMarkers([])).toBeUndefined()
    expect(normalizeMarkers('x')).toBeUndefined()
    const many = Array.from({ length: MAX_MARKERS + 20 }, (_, i) => ({ id: `m${i}`, ms: i * 10 }))
    expect(normalizeMarkers(many)!.length).toBe(MAX_MARKERS)
  })

  it('M toggles at the playhead; next / previous; patch; delete', () => {
    let m = toggleMarkerAt(undefined, 1000, 'm1')
    m = toggleMarkerAt(m, 4000, 'm2')
    expect(m!.map((x) => x.ms)).toEqual([1000, 4000])
    expect(markerAt(m, 1020)?.id).toBe('m1')
    expect(toggleMarkerAt(m, 1010, 'm3')!.map((x) => x.id)).toEqual(['m2'])
    expect(adjacentMarker(m, 1000, 1)?.id).toBe('m2')
    expect(adjacentMarker(m, 4000, 1)).toBeNull()
    expect(adjacentMarker(m, 4000, -1)?.id).toBe('m1')
    expect(adjacentMarker(m, 500, -1)).toBeNull()
    m = patchMarker(m, 'm2', { label: 'Hook', color: 'green', chapter: true })
    expect(m!.find((x) => x.id === 'm2')).toEqual({ id: 'm2', ms: 4000, color: 'green', label: 'Hook', chapter: true })
    m = patchMarker(m, 'm2', { chapter: undefined, label: '' })
    expect(m!.find((x) => x.id === 'm2')).toEqual({ id: 'm2', ms: 4000, color: 'green' })
    expect(patchMarker(m, 'm1', null)!.map((x) => x.id)).toEqual(['m2'])
  })

  it('chapter text: 0:00 first, labels, ≥ 10 s apart, hours when long', () => {
    const m = normalizeMarkers([
      { id: 'a', ms: 15_000, chapter: true, label: 'Setup' },
      { id: 'b', ms: 20_000, chapter: true, label: 'Too close' },
      { id: 'c', ms: 75_000, chapter: true },
      { id: 'd', ms: 90_000, label: 'not a chapter' },
    ])
    expect(chapterText(m, 120_000)).toBe('0:00 Intro\n0:15 Setup\n1:15 Chapter 3')
    expect(chapterText(normalizeMarkers([{ id: 'a', ms: 2000, chapter: true, label: 'Start' }]), 4_000_000)).toBe('0:00:00 Start')
    expect(chapterText(m?.filter((x) => !x.chapter), 1000)).toBe('')
  })

  it('markers ripple with their content when the main video is cut', () => {
    const prev = base({ markers: [{ id: 'm1', ms: 6000, color: 'blue' }] })
    const next = { ...prev, cutRanges: [[1000, 3000]] as [number, number][] }
    const out = rippleAnchoredItems(prev, next, prev, next)
    expect(out.markers).toEqual([{ id: 'm1', ms: 4000, color: 'blue' }])
    expect(rippleMarkers(prev.markers!, (x) => x, 10000)).toBe(prev.markers)
    expect(rippleMarkers(prev.markers!, (x) => x + 9000, 8000)[0]!.ms).toBe(7999)
  })
})

describe('TC1 deactivate (TL-29) + groups (TL-30)', () => {
  const e0 = () =>
    base({
      broll: [broll('b1', 1000, 5000), broll('b2', 6000, 8000)],
      textItems: [{ id: 't1', text: 'Hi', startMs: 0, endMs: 2000 } as unknown as NonNullable<ClipEditsV2['textItems']>[number]],
    })

  it('normalizers drop bad keys / caption deactivation / 1-item groups / double membership', () => {
    expect(normalizeDisabledItems(['broll:b1', 'broll:b1', 'captions:1', 'nope', 3, 'text:t~1'])).toEqual(['broll:b1', 'text:t~1'])
    expect(normalizeDisabledItems([])).toBeUndefined()
    expect(
      normalizeGroups([
        { id: 'g1', items: ['broll:b1', 'text:t1'] },
        { id: 'g2', items: ['broll:b1', 'broll:b2'] },
        { id: 'g3', items: ['broll:b2', 'sfx:s', 'captions:1'] },
        { id: 'bad id', items: ['broll:x', 'broll:y'] },
      ]),
    ).toEqual([
      { id: 'g1', items: ['broll:b1', 'text:t1'] },
      { id: 'g3', items: ['broll:b2', 'sfx:s', 'captions:1'] },
    ])
  })

  it('Shift+E toggles; deactivated items are removed for preview + export (lane-state choke point)', () => {
    let e = e0()
    e = toggleItemsEnabled(e, [{ lane: 'broll', id: 'b1' }, { lane: 'text', id: 't1' }, { lane: 'video', id: 'seg:0' }])!
    expect(e.disabledItems).toEqual(['broll:b1', 'text:t1'])
    const r = applyTimelineLaneState(e)
    expect(r.broll!.map((b) => b.id)).toEqual(['b2'])
    expect(r.textItems).toBeUndefined()
    // still on the timeline
    expect(buildTimelineItems({ edits: e, previewEdits: e }).broll.map((i) => i.id)).toEqual(['b1', 'b2'])
    e = toggleItemsEnabled(e, [{ lane: 'broll', id: 'b1' }])!
    expect(e.disabledItems).toEqual(['text:t1'])
    expect(toggleItemsEnabled(e, [{ lane: 'video', id: 'seg:0' }])).toBeNull()
    expect(isDefaultEdits(base({ disabledItems: ['broll:x'] }), bounds)).toBe(false)
  })

  it('worker parity: apply_item_enable', () => {
    for (const c of FX.disabled) {
      const o = applyItemEnable({ ...base(), ...c.edits, disabledItems: normalizeDisabledItems(c.edits.disabledItems) })
      expect({
        broll: o.broll!.map((b) => b.id),
        textItems: o.textItems ? o.textItems.map((t) => t.id) : null,
        adjustLayers: o.adjustLayers ? o.adjustLayers.map((x) => x.id) : null,
        sfx: o.audio!.sfx.map((s) => s.generationId),
      }).toEqual(c.out)
    }
  })

  it('split children inherit the flags of their parent; deleted items drop out', () => {
    let e = { ...e0(), disabledItems: ['broll:b1'], groups: [{ id: 'g', items: ['broll:b1', 'broll:b2'] }] }
    const split = splitAt(ctxOf(e), [{ lane: 'broll', id: 'b1' }], 3000)!
    const child = split.broll!.find((b) => b.id !== 'b1' && b.id.startsWith('b1'))!
    const out = rippleAnchoredItems(e, split, e, split)
    expect(out.disabledItems).toEqual(['broll:b1', `broll:${child.id}`])
    expect(out.groups![0]!.items.sort()).toEqual(['broll:b1', 'broll:b2', `broll:${child.id}`].sort())
    // a sibling of a disabled split child is not disabled by a later split
    e = { ...out, disabledItems: [`broll:${child.id}`] }
    const split2 = splitAt(ctxOf(e), [{ lane: 'broll', id: 'b1' }], 2000)!
    const out2 = reconcileItemFlags(e, split2)
    expect(out2.disabledItems).toEqual([`broll:${child.id}`])
    const del = deleteItems(ctxOf(out), [{ lane: 'broll', id: 'b2' }])!
    const out3 = rippleAnchoredItems(out, del, out, del)
    expect(out3.groups![0]!.items).not.toContain('broll:b2')
  })

  it('group / ungroup; clicking one member expands to the group', () => {
    const e = groupItems(e0(), [{ lane: 'broll', id: 'b1' }, { lane: 'text', id: 't1' }], 'g1')!
    expect(e.groups).toEqual([{ id: 'g1', items: ['broll:b1', 'text:t1'] }])
    expect(groupItems(e0(), [{ lane: 'broll', id: 'b1' }], 'g')).toBeNull()
    expect(groupOf(e, { lane: 'text', id: 't1' })?.id).toBe('g1')
    const sel = expandToGroups(e, [{ lane: 'broll', id: 'b1' }], (lane, id) => ({ lane, id }))
    expect(sel).toEqual([{ lane: 'broll', id: 'b1' }, { lane: 'text', id: 't1' }])
    // regroup moves members out of their old group (which then dissolves under 2 items)
    const e2 = groupItems(e, [{ lane: 'broll', id: 'b1' }, { lane: 'broll', id: 'b2' }], 'g2')!
    expect(e2.groups).toEqual([{ id: 'g2', items: ['broll:b1', 'broll:b2'] }])
    expect(ungroupItems(e2, [{ lane: 'broll', id: 'b2' }])!.groups).toBeUndefined()
    expect(ungroupItems(e2, [{ lane: 'text', id: 't1' }])).toBeNull()
  })
})

describe('TC1 gaps (TL-34) + magnet (TL-08) + link overlays (TL-14/15)', () => {
  it('reserved gap inserts: normalized without a source, silent, black; windows flag `gap`', () => {
    const got = normalizeInserts(
      [
        { id: 'g1', sourceId: 'gap', atSrcMs: 4000, durMs: 1500, inMs: 300, audio: 'source' },
        { id: 'g2', sourceId: 'gap', atSrcMs: 0, durMs: 50 },
      ],
      [],
    )
    expect(got).toEqual([{ id: 'g1', sourceId: 'gap', atSrcMs: 4000, inMs: 0, durMs: 1500, audio: 'mute' }])
    expect(isGapInsert(got![0]!)).toBe(true)
    const w = insertWindows([[0, 10000]], got)
    expect(w[0]).toMatchObject({ gap: true, startMs: 4000, endMs: 5500 })
    const added = addGapAt(undefined, [[0, 3000], [5000, 10000]], 4000, 'gx')!
    expect(added).toEqual([{ id: 'gx', sourceId: GAP_SOURCE_ID, atSrcMs: 6000, inMs: 0, durMs: 1000, audio: 'mute' }])
    expect(addGapAt(undefined, [[0, 3000]], 3000, 'gy')![0]).toMatchObject({ append: true })
  })

  it('worker parity: normalize + windows', () => {
    for (const c of FX.gapNormalize) expect(normalizeInserts(c.raw, []) ?? null).toEqual(c.out)
    for (const c of FX.gapWindows) expect(insertWindows(c.segs, c.inserts)).toEqual(c.out)
  })

  it('magnet off: deleting a main segment leaves a gap of its length before the next piece', () => {
    const e = base({ videoSplits: [3000, 6000], timelineOpts: { magnet: false } })
    const next = deleteItems(ctxOf(e), [{ lane: 'video', id: 'seg:3000' }])!
    expect(next.cutRanges).toEqual([[3000, 6000]])
    expect(next.inserts).toHaveLength(1)
    expect(next.inserts![0]).toMatchObject({ sourceId: 'gap', atSrcMs: 6000, durMs: 3000, audio: 'mute' })
    // output length is unchanged: 10 s − 3 s cut + 3 s gap
    const tb = timebaseFor(next)
    const wins = insertWindows(tb.segs, next.inserts)
    expect(tb.durationMs + wins.reduce((s, w) => s + w.durMs, 0)).toBe(10000)
    // last segment → appended gap
    const last = deleteItems(ctxOf(e), [{ lane: 'video', id: 'seg:6000' }])!
    expect(last.inserts![0]).toMatchObject({ append: true, durMs: 4000 })
    // magnet on (default) → no gap
    expect(deleteItems(ctxOf(base({ videoSplits: [3000] })), [{ lane: 'video', id: 'seg:0' }])!.inserts).toBeUndefined()
  })

  it('Replace with gap works with the magnet on and keeps the setting', () => {
    const e = base({ videoSplits: [3000, 6000] })
    const next = replaceWithGaps(ctxOf(e), [{ lane: 'video', id: 'seg:0' }])!
    expect(next.timelineOpts).toBeUndefined()
    expect(next.inserts![0]).toMatchObject({ sourceId: 'gap', atSrcMs: 3000, durMs: 3000 })
    expect(replaceWithGaps(ctxOf(e), [{ lane: 'broll', id: 'b' }])).toBeNull()
  })

  it('timeline opts: defaults on, only `false` stored', () => {
    expect(normalizeTimelineOpts({ magnet: true, rippleOverlays: 0 })).toBeUndefined()
    expect(normalizeTimelineOpts({ magnet: false })).toEqual({ magnet: false })
    expect(magnetOn(undefined)).toBe(true)
    expect(rippleOverlaysOn({ rippleOverlays: false })).toBe(false)
    const o = setTimelineOpt(undefined, 'rippleOverlays', false)
    expect(o).toEqual({ rippleOverlays: false })
    expect(setTimelineOpt(o, 'rippleOverlays', true)).toBeUndefined()
  })

  it('unlinked overlays keep their time on a cut; captions / markers still follow', () => {
    const prev = base({
      broll: [broll('b1', 6000, 7000)],
      markers: [{ id: 'm', ms: 6000, color: 'blue' }],
      captionLines: [{ id: 'c1', text: 'hello', startMs: 6000, endMs: 7000 }],
      timelineOpts: { rippleOverlays: false },
    })
    const next = { ...prev, cutRanges: [[1000, 3000]] as [number, number][] }
    const out = rippleAnchoredItems(prev, next, prev, next)
    expect(out.broll![0]).toMatchObject({ startMs: 6000, endMs: 7000 })
    expect(out.markers![0]!.ms).toBe(4000)
    expect(out.captionLines![0]).toMatchObject({ startMs: 4000, endMs: 5000 })
    // linked (default): B-roll moves too
    const linked = { ...prev, timelineOpts: undefined }
    const out2 = rippleAnchoredItems(linked, { ...linked, cutRanges: next.cutRanges }, linked, { ...linked, cutRanges: next.cutRanges })
    expect(out2.broll![0]).toMatchObject({ startMs: 4000, endMs: 5000 })
    // unlinked items past the new end are clamped into the video
    const far = base({ broll: [broll('b1', 9000, 10000)], timelineOpts: { rippleOverlays: false } })
    const cut = { ...far, cutRanges: [[0, 5000]] as [number, number][] }
    const out3 = rippleAnchoredItems(far, cut, far, cut)
    expect(out3.broll![0]!.endMs).toBeLessThanOrEqual(5000)
  })
})

describe('TC1 unlimited tracks (TL-03) — pass cap keeps the preview z-range', () => {
  it('48 visual tracks allowed (was 10)', () => {
    const raw = Array.from({ length: 30 }, (_, i) => ({ id: `ov${i + 1}`, kind: 'overlay' }))
    const t = normalizeTracks(raw)!
    expect(t.filter((x) => x.kind === 'overlay')).toHaveLength(30)
    expect(MAX_VISUAL_TRACKS).toBe(48)
  })
  it('capUnderPasses folds everything above pass 8 into one overlay pass (worker parity)', () => {
    for (const c of FX.cap) expect(capUnderPasses(c.passes)).toEqual(c.out)
    const capped = capUnderPasses(FX.cap[0].passes)
    expect(capped).toHaveLength(MAX_UNDER_PASSES)
    // preview z = 10 + i must stay under the text layer (20)
    expect(10 + capped.length - 1).toBeLessThan(20)
  })
})

describe('TC1 edits fields + preview speed', () => {
  it('normalizeEdits keeps the new fields; payload clears them with null', () => {
    const e = normalizeEdits(
      {
        ...defaultEdits(bounds),
        markers: [{ id: 'm', ms: 100, color: 'red' }],
        disabledItems: ['broll:b'],
        groups: [{ id: 'g', items: ['broll:a', 'broll:b'] }],
        timelineOpts: { magnet: false },
      },
      bounds,
    )
    expect(e.markers).toEqual([{ id: 'm', ms: 100, color: 'red' }])
    expect(e.disabledItems).toEqual(['broll:b'])
    expect(e.groups).toHaveLength(1)
    expect(e.timelineOpts).toEqual({ magnet: false })
    const p = editsPayloadForSave(base())
    expect(p.markers).toBeNull()
    expect(p.disabledItems).toBeNull()
    expect(p.groups).toBeNull()
    expect(p.timelineOpts).toBeNull()
  })

  it('preview speed store: whitelist, subscribe, step', () => {
    let n = 0
    const off = subscribePreviewRate(() => n++)
    setPreviewRate(2)
    expect(getPreviewRate()).toBe(2)
    setPreviewRate(3)
    expect(getPreviewRate()).toBe(1)
    expect(stepPreviewRate(-1)).toBe(0.75)
    expect(stepPreviewRate(1)).toBe(1)
    off()
    setPreviewRate(0.5)
    expect(n).toBe(4)
    setPreviewRate(1)
  })
})
