import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { normalizeEdits, canonicalEditsJson, orderedKeepSegments, type ClipWord } from '@/lib/clips/edits'
import { DraftEditsBuilder } from '@/lib/ai-producer-agent/draft-edits'
import { normalizeTextItems } from '@/lib/clips/editor/text-items'

const bounds = { clipStartMs: 0, clipEndMs: 120_000, trimMinMs: 0, trimMaxMs: 120_000 }
const fixtureWords = (): ClipWord[] => {
  const raw = JSON.parse(
    readFileSync(path.join(__dirname, '__fixtures__', 'words-irl-120s.json'), 'utf8'),
  ) as ClipWord[]
  return raw
}
const flat = () => Array.from({ length: 2400 }, (_, i) => ({ tMs: i * 5, rms: 0.01 }))

describe('every planned item is a normal ClipEditsV2 item', () => {
  const words = fixtureWords()
  const b = new DraftEditsBuilder(bounds, 'src_main', words, flat)
  const s1 = b.addSegment({ sourceId: 'src_main', srcInMs: 10_000, srcOutMs: 20_000, beat: 'setup' })
  const s2 = b.addSegment({ sourceId: 'src_main', srcInMs: 40_000, srcOutMs: 52_000, beat: 'payoff' })
  const s3 = b.addSegment({ sourceId: 'src_main', srcInMs: 30_000, srcOutMs: 36_000, beat: 'hook' }, 0)
  b.setTransition(s2.id, 'whip')
  b.setSplitEdit(s2.id, -300)
  b.addZoom(12_000, 14_000, 1.2, 'snap')
  b.addText('wait for it', 0, 1500, 'hook')
  b.setCaptions({ enabled: true })
  b.setSpeed(45_000, 46_000, 0.5)
  b.setFreeze(50_000, 1000)
  b.setLoudness(-14)
  const e = b.snapshot()
  const twice = normalizeEdits(JSON.parse(canonicalEditsJson(e)), bounds)

  it('round-trips unchanged', () => expect(canonicalEditsJson(twice)).toBe(canonicalEditsJson(e)))
  it('no dropped fields', () => expect(b.droppedFields()).toEqual([]))
  it('segments = keep segments in plan order', () =>
    expect(orderedKeepSegments(e).map(([s]) => s)).toEqual([s3, s1, s2].map((x) => expect.closeTo(x.srcInMs, -2))))
  it('transition keyed by srcMs', () => expect(e.transitions).toContainEqual(expect.objectContaining({ type: 'whip_pan' })))
  it('split edit present', () => expect(e.splitEdits?.length).toBe(1))
  it('zoom = video/scale keyframes', () =>
    expect(e.keyframes?.find((k) => k.target === 'video' && k.prop === 'scale')?.points.length).toBeGreaterThan(2))
  it('text survives normalizeTextItems', () => expect(normalizeTextItems(e.textItems, 120_000)).toHaveLength(1))
  it('every cutRange has cutQualityMeta', () =>
    e.cutRanges.forEach((r) => expect(Object.keys(e.cutQualityMeta ?? {}).length).toBeGreaterThan(0)))
  it('speed/freeze/loudness kept', () => {
    expect(e.segmentSpeeds?.length).toBe(1)
    expect(e.inserts?.length).toBe(1)
    expect(e.loudnessLufs).toBe(-14)
  })
  it('no {start,end} cut ranges', () => e.cutRanges.forEach((r) => expect(Array.isArray(r)).toBe(true)))
})
