import { describe, expect, it } from 'vitest'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import {
  clampPickDrag,
  highlightRangesFromPicks,
  isPickMoved,
  pickWordHighlight,
  picksToLaneRanges,
  visualMomentRows,
  type HighlightPick,
} from '@/lib/clips/editor/highlights'

const pick = (patch: Partial<HighlightPick> & { clipId: string }): HighlightPick => ({
  clipId: patch.clipId,
  title: patch.title ?? 'Pick',
  startMs: patch.startMs ?? 10_000,
  endMs: patch.endMs ?? 20_000,
  score: patch.score ?? 80,
  reasonTag: patch.reasonTag ?? 'speech',
  why: patch.why ?? 'Because',
})

describe('highlights pure', () => {
  it('clampPickDrag keeps ≥3s and 0..duration', () => {
    const r = clampPickDrag({ startMs: 5000, endMs: 9000 }, 'end', 50_000, 60_000)
    expect(r.endMs - r.startMs).toBeGreaterThanOrEqual(3000)
    expect(r.endMs).toBeLessThanOrEqual(60_000)
  })

  it('isPickMoved', () => {
    const p = pick({ clipId: 'c1' })
    expect(isPickMoved(p, { startMs: p.startMs, endMs: p.endMs })).toBe(false)
    expect(isPickMoved(p, { startMs: p.startMs, endMs: p.endMs + 1000 })).toBe(true)
  })

  it('pickWordHighlight by midpoint', () => {
    const p = pick({ clipId: 'c1', startMs: 1000, endMs: 3000 })
    const ranges = highlightRangesFromPicks([p])
    const idx = pickWordHighlight(
      [
        { i: 1, startMs: 500, endMs: 1500 },
        { i: 2, startMs: 4000, endMs: 5000 },
      ],
      [p],
      ranges,
    )
    expect(idx.has(1)).toBe(true)
    expect(idx.has(2)).toBe(false)
  })

  it('visual moment label format', () => {
    const p = pick({ clipId: 'c1', reasonTag: 'visual', startMs: 65_000, endMs: 80_000, why: 'Big play' })
    const rows = visualMomentRows([], [p], highlightRangesFromPicks([p]))
    expect(rows[0]?.label).toMatch(/^▶ Visual moment ·/)
    expect(rows[0]?.label).toContain('Big play')
  })

  it('lane mapping drops fully cut picks', () => {
    const bounds = { clipStartMs: 0, clipEndMs: 30_000, trimMinMs: 0, trimMaxMs: 30_000 }
    const edits = normalizeEdits(
      {
        ...defaultEdits(bounds),
        trim: { in: 0, out: 5000 },
        cutRanges: [[5000, 30_000]],
      },
      bounds,
    )
    const tb = timebaseFor(edits)
    const p = pick({ clipId: 'c1', startMs: 20_000, endMs: 25_000 })
    const lanes = picksToLaneRanges([p], highlightRangesFromPicks([p]), tb)
    expect(lanes.length).toBe(0)
  })
})
