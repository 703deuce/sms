import { describe, expect, it } from 'vitest'
import { orderedKeepSegments } from '@/lib/clips/edits'
import { slideEdit, slideMainClip } from '@/lib/clips/editor/trim-tools'
import { timebaseFor, videoLaneSegments } from '@/lib/clips/editor/clip-timeline'
import { clip5f19e510Edits } from '@/tests/fixtures/clip-5f19e510-edits'

describe('slide clip_5f19e510 (split @4641, cut @29215–29695)', () => {
  const ctx = (e: ReturnType<typeof clip5f19e510Edits>) => ({ edits: e, previewEdits: e })

  it('slide middle clip +300 source ms moves split and cut range, keeps 3 clips', () => {
    const e = clip5f19e510Edits()
    const s = slideEdit(ctx(e), { lane: 'video', id: 'seg:4641' }, 300)
    expect(s).not.toBeNull()
    expect(s!.transitions?.length).toBe(e.transitions?.length ?? 0)
    expect(s!.transitions?.[0]?.type).toBe('spin')
    expect(s!.videoSplits).toEqual([4941])
    expect(s!.cutRanges).toEqual([[29_515, 29_995]])
    expect(s!.transitions).toEqual([{ type: 'spin', durMs: 1000, srcMs: 29_995 }])
    expect(timebaseFor(s!).durationMs).toBe(timebaseFor(e).durationMs)
    const vs = videoLaneSegments(timebaseFor(s!), s!.videoSplits)
    expect(vs).toHaveLength(3)
    expect(vs.map((v) => [v.a, v.b])).toEqual([
      [0, 4941],
      [4941, 29_515],
      [29_995, 32_000],
    ])
    expect(vs[1]!.b - vs[1]!.a).toBe(29_215 - 4641)
  })

  it('slide middle clip -480 source ms keeps all 3 clips and middle length', () => {
    const e = clip5f19e510Edits()
    const s = slideEdit(ctx(e), { lane: 'video', id: 'seg:4641' }, -480)
    expect(s).not.toBeNull()
    expect(s!.videoSplits).toEqual([4161])
    expect(s!.cutRanges).toEqual([[28_735, 29_215]])
    expect(s!.transitions?.[0]?.srcMs).toBe(29_215)
    const vs = videoLaneSegments(timebaseFor(s!), s!.videoSplits)
    expect(vs).toHaveLength(3)
    expect(vs[1]!.b - vs[1]!.a).toBe(29_215 - 4641)
    expect(orderedKeepSegments(s!).length).toBe(2)
  })

  it('slideMainClip direct +300', () => {
    const e = clip5f19e510Edits()
    expect(slideMainClip(ctx(e), 4641, 300)?.videoSplits).toEqual([4941])
  })
})
