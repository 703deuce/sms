import { describe, expect, it } from 'vitest'
import { reversedMediaTime } from '@/components/clips/editor/g4/layer-fx-preview'
import { defaultEdits, editsPayloadForSave, isDefaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import {
  itemReversed,
  normalizeVideoReverse,
  reversePieces,
  reversedSourceMs,
  toggleItemReverse,
} from '@/lib/clips/editor/video-reverse'

const bounds = { clipStartMs: 0, clipEndMs: 30_000, trimMinMs: 0, trimMaxMs: 60_000 }
const base = () => normalizeEdits(defaultEdits(bounds), bounds)

describe('videoReverse', () => {
  it('normalize merges, sorts, drops short and >60s ranges', () => {
    expect(normalizeVideoReverse([{ startMs: 5000, endMs: 5040 }])).toBeUndefined()
    expect(normalizeVideoReverse([{ startMs: 0, endMs: 70_000 }])).toBeUndefined()
    expect(normalizeVideoReverse([{ startMs: 1000, endMs: 4000 }, { startMs: 3500, endMs: 6000 }])).toEqual([
      { startMs: 1000, endMs: 4000 },
      { startMs: 4000, endMs: 6000 },
    ])
  })

  it('reversePieces intersects keep segments after trim and split', () => {
    let e = base()
    e = { ...e, trim: { in: 2000, out: 12000 }, videoReverse: [{ startMs: 0, endMs: 20_000 }] }
    expect(reversePieces(e)).toEqual([[2000, 12000]])
    e = {
      ...e,
      cutRanges: [[5000, 6000]],
      videoReverse: [{ startMs: 2000, endMs: 10000 }],
    }
    expect(reversePieces(e)).toEqual([
      [2000, 5000],
      [6000, 10000],
    ])
  })

  it('ignores pieces longer than 60s on a keep segment', () => {
    const e = {
      ...base(),
      trim: { in: 0, out: 70_000 },
      videoReverse: [{ startMs: 0, endMs: 65_000 }],
    }
    expect(reversePieces(e)).toEqual([])
  })

  it('reversedSourceMs matches reversedMediaTime at endpoints', () => {
    const e = { ...base(), videoReverse: [{ startMs: 1000, endMs: 4000 }] }
    const rs0 = reversedSourceMs(e, 1000)!
    expect(rs0 / 1000).toBeCloseTo(reversedMediaTime(1000, 3000, 0), 6)
    const rsEnd = reversedSourceMs(e, 3990)!
    expect(rsEnd / 1000).toBeCloseTo(reversedMediaTime(1000, 3000, 2990), 6)
    expect(reversedSourceMs(e, 500)).toBeNull()
  })

  it('toggle on and off for a video item span', () => {
    let e = base()
    e = toggleItemReverse(e, 1000, 5000)!
    expect(itemReversed(e, 1000, 5000)).toBe(true)
    expect(e.videoReverse).toEqual([{ startMs: 1000, endMs: 5000 }])
    e = toggleItemReverse(e, 1000, 5000)!
    expect(itemReversed(e, 1000, 5000)).toBe(false)
    expect(e.videoReverse).toBeUndefined()
  })

  it('edits round trip, payload null when empty, isDefaultEdits false with reverse', () => {
    const e = toggleItemReverse(base(), 0, 5000)
    const back = normalizeEdits(JSON.parse(JSON.stringify(e)), bounds)
    expect(back.videoReverse).toEqual([{ startMs: 0, endMs: 5000 }])
    expect(editsPayloadForSave({ ...base(), videoReverse: undefined }).videoReverse).toBeNull()
    expect(isDefaultEdits(e, bounds)).toBe(false)
    expect(isDefaultEdits(base(), bounds)).toBe(true)
  })
})
