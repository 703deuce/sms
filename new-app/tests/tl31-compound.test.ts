import { describe, expect, it } from 'vitest'
import { defaultEdits, editsPayloadForSave, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import {
  applyItemEnable,
  expandToGroups,
  normalizeGroups,
  reconcileItemFlags,
} from '@/lib/clips/editor/item-flags'
import {
  compoundOfSelection,
  compoundView,
  createCompound,
  isCompound,
  trimCompound,
  uncompound,
} from '@/lib/clips/editor/compound'
import { buildTimelineItems, rippleAnchoredItems, splitAt, type OpCtx } from '@/lib/clips/editor/clip-timeline'
import { timelineCommandFor } from '@/lib/clips/editor/timeline-shortcuts'
import { duplicateItems } from '@/lib/clips/editor/timeline-edit-ops'
import { brollPanelThumb } from '@/lib/clips/editor/broll-thumb'
import { replaceItemMedia } from '@/lib/clips/editor/media-add'

const bounds = { clipStartMs: 0, clipEndMs: 60_000, trimMinMs: 0, trimMaxMs: 60_000 }
function base(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return {
    ...normalizeEdits(defaultEdits(bounds), bounds),
    loopFriendlyEnd: false,
    broll: [
      { id: 'b1', source: 'upload', uploadId: 'u1', startMs: 0, endMs: 3000 } as NonNullable<ClipEditsV2['broll']>[number],
      { id: 'b2', source: 'upload', uploadId: 'u2', startMs: 3000, endMs: 6000, inMs: 500 } as NonNullable<ClipEditsV2['broll']>[number],
    ],
    textItems: [{ id: 't1', text: 'Hi', startMs: 1000, endMs: 2000 } as NonNullable<ClipEditsV2['textItems']>[number]],
    captionLines: [{ id: 'c1', text: 'Cap', startMs: 0, endMs: 5000 } as NonNullable<ClipEditsV2['captionLines']>[number]],
    ...patch,
  }
}
const ctxOf = (edits: ClipEditsV2): OpCtx => ({ edits, previewEdits: edits })

describe('TL-31 compound + B-roll panel thumb', () => {
  it('normalizeGroups keeps compound.name; blank → Compound; long name trimmed; garbage dropped', () => {
    expect(normalizeGroups([{ id: 'g1', items: ['broll:a', 'broll:b'], compound: { name: 'Compound 1' } }])).toEqual([
      { id: 'g1', items: ['broll:a', 'broll:b'], compound: { name: 'Compound 1' } },
    ])
    expect(normalizeGroups([{ id: 'g1', items: ['broll:a', 'broll:b'], compound: { name: '   ' } }])![0]!.compound).toEqual({
      name: 'Compound',
    })
    const long = 'x'.repeat(200)
    expect(normalizeGroups([{ id: 'g1', items: ['broll:a', 'broll:b'], compound: { name: long } }])![0]!.compound!.name.length).toBe(60)
    expect(normalizeGroups([{ id: 'g1', items: ['broll:a', 'broll:b'] }])).toEqual([{ id: 'g1', items: ['broll:a', 'broll:b'] }])
    expect(normalizeGroups([{ id: 'g1', items: ['broll:a', 'broll:b'], compound: 5 as unknown as { name: string } }])).toEqual([
      { id: 'g1', items: ['broll:a', 'broll:b'] },
    ])
  })

  it('createCompound with b1+b2+t1 → Compound 1; rowIndexOf orders top row first', () => {
    const e = base()
    const rowIndexOf = (r: { lane: string; id: string }) => (r.lane === 'text' ? 0 : r.id === 'b1' ? 1 : 2)
    const next = createCompound(e, [
      { lane: 'broll', id: 'b2' },
      { lane: 'broll', id: 'b1' },
      { lane: 'text', id: 't1' },
    ], 'c1', rowIndexOf)!
    const g = next.groups!.find((x) => x.id === 'c1')!
    expect(isCompound(g)).toBe(true)
    expect(g.compound.name).toBe('Compound 1')
    expect(g.items[0]).toBe('text:t1')
  })

  it('createCompound ignores ineligible lanes; <2 eligible → null', () => {
    const e = base()
    expect(createCompound(e, [{ lane: 'video', id: 'seg:0' }, { lane: 'broll', id: 'b1' }], 'c1')).toBeNull()
    expect(createCompound(e, [{ lane: 'captions', id: 'c1' }, { lane: 'broll', id: 'b1' }], 'c1')).toBeNull()
    expect(createCompound(e, [{ lane: 'text', id: 'hook' }, { lane: 'broll', id: 'b1' }], 'c1')).toBeNull()
    expect(createCompound(e, [{ lane: 'broll', id: 'b1' }], 'c1')).toBeNull()
  })

  it('members leave old group; second compound is Compound 2', () => {
    let e = base({ groups: [{ id: 'g0', items: ['broll:b1', 'text:t1'] }] })
    e = createCompound(
      e,
      [
        { lane: 'broll', id: 'b2' },
        { lane: 'text', id: 't1' },
      ],
      'c1',
    )!
    expect(e.groups!.find((g) => g.id === 'g0')).toBeUndefined()
    e = createCompound(
      e,
      [
        { lane: 'broll', id: 'b1' },
        { lane: 'broll', id: 'b2' },
      ],
      'c2',
    )!
    const c2 = e.groups!.find((g) => g.id === 'c2')!
    expect(c2.compound!.name).toBe('Compound 2')
  })

  it('uncompound removes entry; unknown id → null', () => {
    const e = base({ groups: [{ id: 'c1', items: ['broll:b1', 'broll:b2'], compound: { name: 'Compound 1' } }] })
    expect(uncompound(e, 'c1')!.groups).toBeUndefined()
    expect(uncompound(e, 'nope')).toBeNull()
  })

  it('compoundOfSelection: exact set only; plain group → null', () => {
    const e = base({ groups: [{ id: 'c1', items: ['broll:b1', 'broll:b2'], compound: { name: 'C' } }] })
    expect(compoundOfSelection(e, [
      { lane: 'broll', id: 'b1' },
      { lane: 'broll', id: 'b2' },
    ])?.id).toBe('c1')
    expect(compoundOfSelection(e, [{ lane: 'broll', id: 'b1' }])).toBeNull()
    const plain = base({ groups: [{ id: 'g1', items: ['broll:b1', 'broll:b2'] }] })
    expect(compoundOfSelection(plain, [
      { lane: 'broll', id: 'b1' },
      { lane: 'broll', id: 'b2' },
    ])).toBeNull()
  })

  it('compoundView collapsed vs open', () => {
    const e = base({
      groups: [{ id: 'c1', items: ['broll:b1', 'broll:b2', 'text:t1'], compound: { name: 'Compound 1' } }],
    })
    const lanes = buildTimelineItems({ edits: e, previewEdits: e })
    const closed = compoundView(e, lanes, null)
    expect(closed.hosts.size).toBe(1)
    const host = [...closed.hosts.values()][0]!
    expect(host.startMs).toBe(0)
    expect(host.endMs).toBe(6000)
    expect(host.count).toBe(3)
    expect(closed.hidden.size).toBe(2)
    const open = compoundView(e, lanes, 'c1')
    expect(open.hosts.size).toBe(0)
    expect(open.hidden.size).toBe(0)
  })

  it('trimCompound start 3500 and end 2500', () => {
    const e = base({
      groups: [{ id: 'c1', items: ['broll:b1', 'broll:b2', 'text:t1'], compound: { name: 'C' } }],
    })
    const ctx = ctxOf(e)
    const s = trimCompound(ctx, e.groups![0]!, 'start', 3500)!
    expect(s.broll!.find((b) => b.id === 'b1')).toBeUndefined()
    expect(s.broll!.find((b) => b.id === 'b2')!.startMs).toBe(3500)
    expect(s.broll!.find((b) => b.id === 'b2')!.inMs).toBe(1000)
    expect(s.textItems?.length ?? 0).toBe(0)
    const e2 = base({
      groups: [{ id: 'c1', items: ['broll:b1', 'broll:b2', 'text:t1'], compound: { name: 'C' } }],
    })
    const end = trimCompound(ctxOf(e2), e2.groups![0]!, 'end', 2500)!
    expect(end.broll!.find((b) => b.id === 'b2')).toBeUndefined()
    expect(end.broll!.find((b) => b.id === 'b1')!.endMs).toBe(2500)
  })

  it('trimCompound clamps and never empties', () => {
    const e = base({ groups: [{ id: 'c1', items: ['broll:b1', 'broll:b2'], compound: { name: 'C' } }] })
    const g = e.groups![0]!
    expect(trimCompound(ctxOf(e), g, 'start', 0)).toBeNull()
    expect(trimCompound(ctxOf(e), g, 'start', 6000)).toBeNull()
  })

  it('trimCompound + reconcile keeps compound; split child joins group', () => {
    let e = base({ groups: [{ id: 'c1', items: ['broll:b1', 'broll:b2'], compound: { name: 'C' } }] })
    e = trimCompound(ctxOf(e), e.groups![0]!, 'end', 4000)!
    e = rippleAnchoredItems(e, e, e, e)
    expect(e.groups![0]!.compound!.name).toBe('C')
    const split = splitAt(ctxOf(e), [{ lane: 'broll', id: 'b1' }], 1500)!
    const rip = rippleAnchoredItems(e, split, e, split)
    const keys = rip.groups![0]!.items
    expect(keys.some((k) => k.startsWith('broll:b1~'))).toBe(true)
    expect(rip.groups![0]!.compound!.name).toBe('C')
  })

  it('expandToGroups skipGroupId', () => {
    const e = base({
      groups: [
        { id: 'c1', items: ['broll:b1', 'broll:b2'], compound: { name: 'C' } },
        { id: 'g2', items: ['text:t1', 'broll:b1'] },
      ],
    })
    const one = expandToGroups(e, [{ lane: 'broll', id: 'b1' }], (lane, id) => ({ lane, id }), 'c1')
    expect(one).toEqual([{ lane: 'broll', id: 'b1' }])
    const other = expandToGroups(e, [{ lane: 'text', id: 't1' }], (lane, id) => ({ lane, id }), 'c1')
    expect(other.length).toBeGreaterThan(1)
  })

  it('timelineCommandFor Alt+G / Alt+Shift+G / ©', () => {
    expect(timelineCommandFor({ key: 'g', altKey: true })).toBe('compound')
    expect(timelineCommandFor({ key: 'G', altKey: true, shiftKey: true })).toBe('uncompound')
    expect(timelineCommandFor({ key: '©', code: 'KeyG', altKey: true })).toBe('compound')
    expect(timelineCommandFor({ key: 'g', ctrlKey: true })).toBe('group')
  })

  it('export neutrality and payload round-trip', () => {
    const withCompound = base({ groups: [{ id: 'c1', items: ['broll:b1', 'broll:b2'], compound: { name: 'C' } }] })
    const withoutGroups = base()
    const a = applyItemEnable(withCompound)
    const b = applyItemEnable(withoutGroups)
    expect({ ...a, groups: undefined }).toEqual({ ...b, groups: undefined })
    const payload = editsPayloadForSave(withCompound, bounds)
    const round = normalizeEdits(payload as ClipEditsV2, bounds)
    expect(round.groups![0]!.compound).toEqual({ name: 'C' })
  })

  it('duplicate wrap creates second compound', () => {
    let e = base({ groups: [{ id: 'c1', items: ['broll:b1', 'broll:b2'], compound: { name: 'Compound 1' } }] })
    const dup = duplicateItems(ctxOf(e), [
      { lane: 'broll', id: 'b1' },
      { lane: 'broll', id: 'b2' },
    ])!
    const wrapped = createCompound(dup.edits, dup.refs, 'c2', undefined, 'Compound 1 copy')!
    const compounds = wrapped.groups!.filter(isCompound)
    expect(compounds.length).toBe(2)
    const ids = compounds.flatMap((g) => g.items)
    expect(new Set(ids).size).toBe(4)
  })

  it('A1 brollPanelThumb', () => {
    expect(brollPanelThumb({ source: 'upload' }, { id: 'b1', url: 'https://v.mp4', mediaType: 'video' })).toEqual({
      kind: 'video',
      src: 'https://v.mp4',
    })
    expect(brollPanelThumb({ source: 'upload', still: true }, { id: 'b1', url: 'https://i.png', mediaType: 'image' })).toEqual({
      kind: 'img',
      src: 'https://i.png',
    })
    expect(
      brollPanelThumb({ source: 'stock' }, { id: 'b1', thumbUrl: 'https://thumb.jpg', url: 'https://v.mp4', mediaType: 'video' }),
    ).toEqual({ kind: 'img', src: 'https://thumb.jpg' })
  })

  it('A2 previewBrollMedia-style row after replaceItemMedia', () => {
    const stockItem = { id: 'b1', source: 'stock' as const, assetId: 'st1', startMs: 0, endMs: 3000 } as import('@/lib/clips/broll').BrollItem
    const { item: replaced } = replaceItemMedia(stockItem, {
      id: 'lib',
      ref: 'upload',
      refId: 'up_new',
      mediaType: 'video',
      label: 'v',
      durationMs: 10_000,
      width: 1920,
      height: 1080,
      url: 'https://upload.example/v.mp4',
      syncMs: null,
      syncStatus: 'none',
    })
    expect(replaced!.source).toBe('upload')
    const brollMedia = [
      { id: 'b1', thumbUrl: 'https://stock-thumb.jpg', url: 'https://stock.mp4', mediaType: 'video', assetId: 'st1' },
    ]
    const byId = new Map([[replaced!.id, replaced!]])
    const liveServer = brollMedia.filter((r) => {
      const it = byId.get(r.id)
      if (!it) return true
      if (it.source === 'upload') return false
      return it.source === 'stock' ? r.assetId === (it as { assetId?: string }).assetId : false
    })
    const uploadRow = { id: 'b1', url: 'https://upload.example/v.mp4', mediaType: 'video' as const }
    const previewRows = [...liveServer, uploadRow]
    const row = previewRows.find((r) => r.id === replaced!.id)
    expect(brollPanelThumb(replaced!, row)).toEqual({ kind: 'video', src: 'https://upload.example/v.mp4' })
  })
})
