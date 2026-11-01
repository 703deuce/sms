import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits, orderedKeepSegments } from '@/lib/clips/edits'
import { slideEdit, slideMainClip } from '@/lib/clips/editor/trim-tools'
import { timebaseFor, videoLaneSegments } from '@/lib/clips/editor/clip-timeline'

/** Prod MC-style clip: trim out 31520, videoSplits at 4640 and 29210 (Clip 2 middle). */
const bounds = { clipStartMs: 0, clipEndMs: 31_520 }
const mcSplits = (): ReturnType<typeof normalizeEdits> =>
  normalizeEdits({ ...defaultEdits(bounds), videoSplits: [4640, 29210] }, bounds)

describe('slide MC three-clip contiguous splits', () => {
  const ctx = (e: ReturnType<typeof mcSplits>) => ({ edits: e, previewEdits: e })

  it('slide +300 ms → splits [4940, 29510], duration unchanged, 3 clips', () => {
    const e = mcSplits()
    const s = slideEdit(ctx(e), { lane: 'video', id: 'seg:4640' }, 300)
    expect(s).not.toBeNull()
    expect(s!.videoSplits).toEqual([4940, 29510])
    expect(timebaseFor(s!).durationMs).toBe(31_520)
    const vs = videoLaneSegments(timebaseFor(s!), s!.videoSplits)
    expect(vs).toHaveLength(3)
    expect(vs.map((v) => [v.a, v.b])).toEqual([
      [0, 4940],
      [4940, 29510],
      [29510, 31_520],
    ])
  })

  it('slide -480 ms → splits [4160, 28730], all 3 clips kept, middle source span unchanged', () => {
    const e = mcSplits()
    const s = slideEdit(ctx(e), { lane: 'video', id: 'seg:4640' }, -480)
    expect(s).not.toBeNull()
    expect(s!.videoSplits).toEqual([4160, 28730])
    expect(timebaseFor(s!).durationMs).toBe(31_520)
    const vs = videoLaneSegments(timebaseFor(s!), s!.videoSplits)
    expect(vs).toHaveLength(3)
    const mid = vs[1]!
    expect(mid.b - mid.a).toBe(29_210 - 4640) // same source length 24_570 ms
    expect(orderedKeepSegments(s!).length).toBe(1) // single keep segment still
  })

  it('slideMainClip direct', () => {
    const e = mcSplits()
    expect(slideMainClip(ctx(e), 4640, 300)?.videoSplits).toEqual([4940, 29510])
  })
})
