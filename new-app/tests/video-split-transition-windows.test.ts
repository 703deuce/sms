import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import {
  cutTransitionWindows,
  videoSplitAutoCrossfadeWindows,
  videoSplitTransitionWindows,
} from '@/lib/clips/editor/transitions'

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

  it('auto crossfade wedge at split without stored transition when Xfade on', () => {
    const edits = normalizeEdits(
      {
        ...defaultEdits({ clipStartMs: 0, clipEndMs: 32_000 }),
        videoSplits: [4641],
        cutRanges: [[29_215, 29_695]],
        transitions: [{ srcMs: 29_695, type: 'spin', durMs: 1000 }],
      },
      { clipStartMs: 0, clipEndMs: 32_000 },
    )
    const tb = timebaseFor(edits)
    expect(videoSplitTransitionWindows(tb, edits.videoSplits, edits.transitions)).toHaveLength(0)
    const auto = videoSplitAutoCrossfadeWindows(tb, edits.videoSplits, edits.transitions)
    expect(auto).toHaveLength(1)
    expect(auto[0]!.srcMs).toBe(4641)
    expect(auto[0]!.type).toBe('crossfade')
  })
})
