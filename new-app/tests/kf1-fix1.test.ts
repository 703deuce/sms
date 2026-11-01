import { describe, expect, it } from 'vitest'
import { defaultEdits, editMsAtDisplayMs, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { trackValueAt, type KeyframeTrack } from '@/lib/clips/editor/keyframes'
import {
  keyframeLaneFraction,
  keyframeLocalEditFromPlayhead,
  keyframeTimingActive,
  keyframesUseSegmentWarp,
} from '@/lib/clips/editor/keyframe-time'
import { warpMs, type WarpPiece } from '@/lib/clips/editor/speed'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }

function edits(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return { ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false, ...patch }
}

/** Hand-test shape: slow first half, fast second (edit ms). */
const PIECES: WarpPiece[] = [
  { startMs: 0, endMs: 1584, speed: 0.5 },
  { startMs: 1584, endMs: 3167, speed: 2 },
]

describe('KF1-fix1 keyframe time under segment speed', () => {
  it('value at segment-real warpMs(1000) matches value at edit ms 1000', () => {
    const track: KeyframeTrack = {
      target: 'video',
      prop: 'x',
      points: [
        { tMs: 0, v: 0 },
        { tMs: 3167, v: 40 },
      ],
    }
    const atEdit = trackValueAt(track, 'x', 1000)
    const realMs = warpMs(PIECES, 1000)
    const e = edits({
      segmentSpeeds: [
        { fromMs: 0, toMs: 1584, speed: 0.5 },
        { fromMs: 1584, toMs: 3167, speed: 2 },
      ],
    })
    expect(keyframesUseSegmentWarp(e)).toBe(true)
    const playheadEdit = editMsAtDisplayMs(e, realMs)
    expect(playheadEdit).toBeCloseTo(1000, 0)
    const atPlayhead = trackValueAt(track, 'x', keyframeLocalEditFromPlayhead(e, playheadEdit, 0))
    expect(atPlayhead).toBeCloseTo(atEdit, 5)
  })

  it('diamond at edit tMs 3167 is drawn at warpMs(3167) lane fraction', () => {
    const e = edits({
      segmentSpeeds: [
        { fromMs: 0, toMs: 1584, speed: 0.5 },
        { fromMs: 1584, toMs: 3167, speed: 2 },
      ],
    })
    const origin = 0
    const spanFrom = 0
    const spanTo = 3167
    const frac = keyframeLaneFraction(e, origin, spanFrom, spanTo, 3167)
    const expected = warpMs(PIECES, 3167) / warpMs(PIECES, 3167)
    expect(frac).toBeCloseTo(expected, 5)
    const linear = 3167 / 3167
    expect(frac).not.toBeCloseTo(linear / 2, 2)
    expect(warpMs(PIECES, 3167)).toBeGreaterThan(1500)
    expect(frac).toBeCloseTo(1, 5)
  })

  it('identity when no segment speed change', () => {
    const e = edits()
    expect(keyframeTimingActive(e)).toBe(false)
    expect(keyframeLocalEditFromPlayhead(e, 2500, 0)).toBe(2500)
    expect(keyframeLaneFraction(e, 0, 0, 5000, 2500)).toBeCloseTo(0.5, 10)
  })
})
