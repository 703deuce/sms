import { describe, expect, it } from 'vitest'
import { badgeRect } from '@/lib/clips/overlay-geometry'
import { overlayLayout } from '@/lib/clips/stream-overlay-layout'
import { resolveStreamOverlayLayout } from '@/lib/clips/stream-compose-layout'
import type { ClipEditsV2 } from '@/lib/clips/edits'

const clipAHeadlineEdits = (): ClipEditsV2 =>
  ({
    v: 2,
    trim: { in: 0, out: 6640 },
    cutRanges: [],
    wordFixes: {},
    layout: { mode: 'speaker_follow', shotOverrides: [] },
    captions: { enabled: true, presetId: 'bold_pop', position: 'bottom' },
    exportTemplate: {
      headlineBar: { enabled: true, text: 'AFTER KOBE REACTION THERE WE GO' },
      platformBadge: { enabled: true },
      platform: 'twitch',
    },
  }) as ClipEditsV2

describe('stream compose geometry parity', () => {
  it('resolveStreamOverlayLayout matches overlayLayout golden', () => {
    const lay = resolveStreamOverlayLayout(clipAHeadlineEdits(), 2)
    const golden = overlayLayout(2)
    for (const key of Object.keys(golden) as (keyof typeof golden)[]) {
      expect(lay[key]).toBe(golden[key])
    }
  })

  it('badge top-gap anchor sits above headline band', () => {
    const rect = badgeRect('fit_top_band', 1080, 1920, {
      text: 'TWITCH',
      showLogo: true,
      anchorTopGap: true,
    })
    expect(rect.y).toBeGreaterThanOrEqual(20)
    expect(rect.y).toBeLessThan(150)
  })
})
