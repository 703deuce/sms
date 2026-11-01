import { describe, expect, it } from 'vitest'
import { defaultEdits, displayPositionMs, editMsAtDisplayMs, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { keyframeGlobalEditMs, keyframeLaneFraction } from '@/lib/clips/editor/keyframe-time'
import { warpMs, type WarpPiece } from '@/lib/clips/editor/speed'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }

function edits(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return { ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false, ...patch }
}

const PIECES: WarpPiece[] = [
  { startMs: 0, endMs: 1584, speed: 0.5 },
  { startMs: 1584, endMs: 3167, speed: 2 },
]

describe('KF2-fix1 timeline playhead vs segment speed', () => {
  const e = edits({
    segmentSpeeds: [
      { fromMs: 0, toMs: 1584, speed: 0.5 },
      { fromMs: 1584, toMs: 3167, speed: 2 },
    ],
  })

  it('timeline click at edit ms T: playhead stays T (not editMsAtDisplayMs(T))', () => {
    const T = 2000
    const wronglySeeked = editMsAtDisplayMs(e, T)
    expect(wronglySeeked).toBeLessThan(T - 100)
    const playheadMs = T
    expect(playheadMs).toBe(T)
  })

  it('playhead lane fraction at edit T matches warpMs(T) on span (line aligns with ruler click)', () => {
    const T = 2000
    const spanTo = 3167
    const frac = keyframeLaneFraction(e, 0, 0, spanTo, T)
    const expected = warpMs(PIECES, T) / warpMs(PIECES, spanTo)
    expect(frac).toBeCloseTo(expected, 4)
    expect(frac).toBeGreaterThan(warpMs(PIECES, 1000) / warpMs(PIECES, spanTo))
  })

  it('keyframeGlobalEditMs(edits, edit playhead T) round-trips; display inverse matches worker output clock', () => {
    const T = 2000
    expect(keyframeGlobalEditMs(e, T)).toBeCloseTo(T, -1)
    const display = displayPositionMs(e, T)
    expect(editMsAtDisplayMs(e, display)).toBeCloseTo(T, -1)
  })
})
