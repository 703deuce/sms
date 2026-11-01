import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { cutTransitionWindows, videoSplitTransitionWindows } from '@/lib/clips/editor/transitions'

describe('videoSplitTransitionWindows', () => {
  it('shows wedge region at a video split with crossfade (not a real cut)', () => {
    const bounds = { clipStartMs: 0, clipEndMs: 10_000 }
    const edits = normalizeEdits(
      {
        ...defaultEdits(bounds),
        videoSplits: [4640],
        transitions: [{ srcMs: 4640, type: 'crossfade', durMs: 400 }],
      },
      bounds,
    )
    const tb = timebaseFor(edits)
    const realCuts = cutTransitionWindows(tb.segs, tb.starts, edits.transitions)
    expect(realCuts).toHaveLength(0)
    const splitWins = videoSplitTransitionWindows(tb, edits.videoSplits, edits.transitions)
    expect(splitWins).toHaveLength(1)
    expect(splitWins[0]!.srcMs).toBe(4640)
    expect(splitWins[0]!.type).toBe('crossfade')
  })
})
