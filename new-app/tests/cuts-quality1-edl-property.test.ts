import { describe, expect, it } from 'vitest'
import {
  defaultEdits,
  mergeCutRanges,
  normalizeEdits,
  orderedKeepSegments,
  outputDurationMs,
  subtractRangeFromCuts,
  type ClipWord,
} from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 60_000, trimMinMs: 0, trimMaxMs: 60_000 }

function words(): ClipWord[] {
  const out: ClipWord[] = []
  for (let i = 0; i < 40; i++) {
    const s = i * 0.5
    out.push({ w: `w${i}`, s, e: s + 0.35, i })
  }
  return out
}

describe('CUTS_QUALITY1 EDL property', () => {
  it('random cut/restore keeps timeline duration == sum of keep spans', () => {
    let edits = normalizeEdits(defaultEdits(bounds), bounds)
    for (let n = 0; n < 200; n++) {
      const w = words()
      const i = Math.floor(Math.random() * (w.length - 2)) + 1
      if (n % 2 === 0) {
        const lo = Math.round(w[i]!.s * 1000)
        const hi = Math.round(w[i]!.e * 1000)
        if (hi - lo >= 40) {
          edits = { ...edits, cutRanges: mergeCutRanges([...edits.cutRanges, [lo, hi]]) }
        }
      } else if (edits.cutRanges.length) {
        const r = edits.cutRanges[Math.floor(Math.random() * edits.cutRanges.length)]!
        edits = { ...edits, cutRanges: subtractRangeFromCuts(edits.cutRanges, r) }
      }
      const segs = orderedKeepSegments(edits)
      const kept = segs.reduce((n, [a, b]) => n + (b - a), 0)
      expect(Math.abs(outputDurationMs(edits) - kept)).toBeLessThanOrEqual(33)
    }
  })
})
