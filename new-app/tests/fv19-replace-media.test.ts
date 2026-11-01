import { describe, expect, it } from 'vitest'
import { normalizeBrollItems, type BrollItem } from '@/lib/clips/broll'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import {
  replaceBrollMedia,
  replaceItemMedia,
  type ProjectMediaItem,
} from '@/lib/clips/editor/media-add'

const vid = (len: number, refId = 'up_new'): ProjectMediaItem => ({
  id: 'lib_v',
  ref: 'upload',
  refId,
  mediaType: 'video',
  label: 'v.mp4',
  durationMs: len,
  width: 1920,
  height: 1080,
  url: 'https://example.com/v.mp4',
  syncMs: null,
  syncStatus: 'none',
})

const img = (): ProjectMediaItem => ({
  id: 'lib_i',
  ref: 'upload',
  refId: 'up_img',
  mediaType: 'image',
  label: 'still.png',
  durationMs: null,
  width: 800,
  height: 600,
  url: 'https://example.com/i.png',
  syncMs: null,
  syncStatus: 'none',
})

const aud = (): ProjectMediaItem => ({
  id: 'lib_a',
  ref: 'upload',
  refId: 'up_aud',
  mediaType: 'audio',
  label: 'a.mp3',
  durationMs: 5000,
  width: null,
  height: null,
  url: null,
  syncMs: null,
  syncStatus: 'none',
})

const take = (): ProjectMediaItem => ({
  id: 'lib_t',
  ref: 'take',
  refId: 'trk_1',
  mediaType: 'video',
  label: 'angle',
  durationMs: 10_000,
  width: 1920,
  height: 1080,
  url: null,
  syncMs: 0,
  syncStatus: 'clock',
})

const main = (): ProjectMediaItem => ({
  ...vid(60_000),
  id: 'main',
  refId: 'up_main',
  isMain: true,
})

const baseBroll = (): BrollItem =>
  ({
    id: 'b1',
    source: 'upload',
    uploadId: 'up_old',
    startMs: 2000,
    endMs: 6000,
    inMs: 1500,
    placement: 'auto',
    transitionIn: { type: 'crossfade', durMs: 300 },
    anim: { in: 'fade', out: 'fade' },
  }) as BrollItem

describe('replaceItemMedia', () => {
  it('video→longer video keeps timing and edits fields', () => {
    const b = baseBroll()
    const r = replaceItemMedia(b, vid(20_000))
    expect(r.error).toBeUndefined()
    expect(r.item!.id).toBe('b1')
    expect(r.item!.startMs).toBe(2000)
    expect(r.item!.endMs).toBe(6000)
    expect(r.item!.inMs).toBe(1500)
    expect(r.item!.transitionIn).toEqual(b.transitionIn)
    expect(r.item!.anim).toEqual(b.anim)
    expect(r.item!.placement).toBe('manual')
    expect(r.item!.uploadId).toBe('up_new')
    expect(r.shortened).toBe(false)
  })

  it('in-point clamp when inMs+dur exceeds source length', () => {
    const r = replaceItemMedia(baseBroll(), vid(5000))
    expect(r.item!.inMs).toBeUndefined()
    expect(r.item!.endMs).toBe(6000)
    expect(r.shortened).toBe(false)
  })

  it('shortens when new media is shorter than item duration', () => {
    const r = replaceItemMedia(baseBroll(), vid(2500))
    expect(r.item!.inMs).toBeUndefined()
    expect(r.item!.endMs).toBe(4500)
    expect(r.shortened).toBe(true)
  })

  it('rejects media under 1s', () => {
    expect(replaceItemMedia(baseBroll(), vid(800)).error).toBe('That clip is too short (min 1 s)')
  })

  it('unknown duration keeps inMs and length', () => {
    const r = replaceItemMedia(baseBroll(), { ...vid(10_000), durationMs: null })
    expect(r.item!.inMs).toBe(1500)
    expect(r.item!.endMs).toBe(6000)
    expect(r.shortened).toBe(false)
  })

  it('video→image sets still and drops inMs', () => {
    const r = replaceItemMedia(baseBroll(), img())
    expect(r.item!.still).toBe(true)
    expect(r.item!.inMs).toBeUndefined()
    expect(r.item!.endMs).toBe(6000)
  })

  it('image→video drops still and applies trim', () => {
    const b: BrollItem = { id: 'b1', source: 'upload', uploadId: 'up_old', still: true, startMs: 2000, endMs: 6000, placement: 'manual' }
    const r = replaceItemMedia(b, vid(2500))
    expect('still' in r.item! && r.item!.still).toBeFalsy()
    expect(r.item!.inMs).toBeUndefined()
    expect(r.item!.endMs).toBe(4500)
    expect(r.shortened).toBe(true)
  })

  it('stock→upload and ai→upload drop legacy ids', () => {
    const stock: BrollItem = { id: 'b1', source: 'stock', assetId: 'stk', startMs: 0, endMs: 3000, placement: 'auto' }
    const s = replaceItemMedia(stock, vid(9000))
    expect(s.item!.source).toBe('upload')
    expect((s.item as Record<string, unknown>).assetId).toBeUndefined()
    const ai: BrollItem = { id: 'b2', source: 'ai', generationId: 'gen', startMs: 0, endMs: 3000 }
    const a = replaceItemMedia(ai, vid(9000))
    expect((a.item as Record<string, unknown>).generationId).toBeUndefined()
  })

  it('rejects audio, take, and main', () => {
    const b = baseBroll()
    expect(replaceItemMedia(b, aud()).error).toMatch(/overlay/)
    expect(replaceItemMedia(b, take()).error).toMatch(/overlay/)
    expect(replaceItemMedia(b, main()).error).toMatch(/overlay/)
  })
})

describe('replaceBrollMedia', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 60_000 }

  it('only replaces matching id and preserves unrelated edit subtrees', () => {
    const edits = normalizeEdits(
      {
        ...defaultEdits(bounds),
        broll: [
          baseBroll(),
          { id: 'b2', source: 'stock', assetId: 'x', startMs: 1000, endMs: 2000 },
        ],
        keyframes: [{ target: 'broll:b1', prop: 'x', points: [{ tMs: 0, v: 50 }] }],
        layerProps: { 'broll:b1': { x: 10 } },
        layerFx: [{ target: 'broll:b1', mask: { shape: 'rect', x: 0, y: 0, w: 1, h: 1 } }],
        color: { broll: { b1: { exposure: 1 } } },
        tracks: { overlay: { order: ['b1'] } },
        disabledItems: [],
        groups: [],
      },
      bounds,
    )
    const kf = edits.keyframes
    const lp = edits.layerProps
    const lf = edits.layerFx
    const col = edits.color
    const tr = edits.tracks
    const dis = edits.disabledItems
    const gr = edits.groups
    const r = replaceBrollMedia(edits, 'b1', vid(20_000))
    expect(r.edits).not.toBeNull()
    expect(r.edits!.broll!.find((x) => x.id === 'b2')).toEqual(edits.broll!.find((x) => x.id === 'b2'))
    expect(r.edits!.broll!.find((x) => x.id === 'b1')!.uploadId).toBe('up_new')
    expect(r.edits!.keyframes).toBe(kf)
    expect(r.edits!.layerProps).toBe(lp)
    expect(r.edits!.layerFx).toBe(lf)
    expect(r.edits!.color).toBe(col)
    expect(r.edits!.tracks).toBe(tr)
    expect(r.edits!.disabledItems).toBe(dis)
    expect(r.edits!.groups).toBe(gr)
  })

  it('unknown id and shorten message', () => {
    const edits = normalizeEdits({ ...defaultEdits(bounds), broll: [baseBroll()] }, bounds)
    expect(replaceBrollMedia(edits, 'nope', vid(9000)).edits).toBeNull()
    const short = replaceBrollMedia(edits, 'b1', vid(2500))
    expect(short.message).toMatch(/^Shortened to 2\.5s/)
  })

  it('round trip through normalizeBrollItems', () => {
    const edits = normalizeEdits({ ...defaultEdits(bounds), broll: [baseBroll()] }, bounds)
    const r = replaceBrollMedia(edits, 'b1', vid(20_000))
    const norm = normalizeBrollItems(r.edits!.broll, 60_000)
    const one = norm.find((x) => x.id === 'b1')!
    expect(one.uploadId).toBe('up_new')
    expect(one.inMs).toBe(1500)
    expect(one.placement).toBe('manual')
  })
})
