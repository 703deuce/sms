import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits, orderedKeepSegments } from '@/lib/clips/edits'
import { applyPlaybackTime, sourceMsAtOutput } from '@/lib/clips/editor-playback'

describe('editor playback reorder', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 10000 }
  const edits = normalizeEdits(
    {
      ...defaultEdits(bounds),
      trim: { in: 0, out: 10000 },
      sectionOrder: [
        [5000, 10000],
        [0, 5000],
      ],
    },
    bounds,
  )

  it('ordered segments swap halves', () => {
    expect(orderedKeepSegments(edits)).toEqual([
      [5000, 10000],
      [0, 5000],
    ])
  })

  it('jumps to next block at segment end', () => {
    const atEndFirst = applyPlaybackTime(9999, edits)
    expect(atEndFirst.sourceMs).toBe(0)
    expect(atEndFirst.atEnd).toBe(false)
  })

  it('atEnd only after last block', () => {
    const end = applyPlaybackTime(10000, edits)
    expect(end.atEnd).toBe(true)
  })

  it('cut skip jumps to next ordered segment', () => {
    const withCut = normalizeEdits(
      {
        ...edits,
        cutRanges: [[5200, 5400]],
      },
      bounds,
    )
    const jumped = applyPlaybackTime(5300, withCut)
    expect(jumped.sourceMs).toBe(5400)
    expect(jumped.atEnd).toBe(false)
  })

  it('sourceMsAtOutput maps through block order', () => {
    expect(sourceMsAtOutput(edits, 0)).toBe(5000)
    expect(sourceMsAtOutput(edits, 5000)).toBe(0)
  })
})
