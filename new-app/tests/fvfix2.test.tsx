// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { clipExportMediaReady } from '@/lib/clips/clip-export-media'
import { formatDur } from '@/lib/clips/format'
import { insetCanvasHandle } from '@/components/clips/editor/canvas-selection-overlay'

vi.mock('@/lib/billing/entitlements', () => ({
  can: () => true,
  featuresAllUnlocked: () => true,
}))

describe('FVfix2 formatDur', () => {
  it('floors seconds on list cards (59.9 s → 0:59 not 1:00)', () => {
    expect(formatDur(59_900)).toBe('0:59')
    expect(formatDur(60_000)).toBe('1:00')
  })
})

describe('FVfix2 full-video export gate', () => {
  it('allows export without preview when full-video has upload/proxy/segment', () => {
    expect(
      clipExportMediaReady(
        { previewKey: null, sourceSegKey: null },
        { settings: { fullVideo: true }, upload: { key: 'ws/x/upload.mp4' } },
      ),
    ).toBe(true)
    expect(
      clipExportMediaReady(
        { previewKey: null, sourceSegKey: 'ws/x/seg.mp4' },
        { settings: { fullVideo: true }, upload: null },
      ),
    ).toBe(true)
    expect(
      clipExportMediaReady(
        { previewKey: null, sourceSegKey: null },
        { settings: { fullVideo: true }, proxyKey: 'ws/x/proxy.mp4' },
      ),
    ).toBe(true)
  })

  it('still blocks non-full-video clips without preview', () => {
    expect(
      clipExportMediaReady(
        { previewKey: null, sourceSegKey: null },
        { settings: {}, upload: { key: 'ws/x/upload.mp4' } },
      ),
    ).toBe(false)
  })
})

describe('FVfix2 canvas handles', () => {
  it('insets corner handles so they stay visible on a full-frame video layer', () => {
    expect(insetCanvasHandle({ x: 0, y: 0 }, 320, 240)).toEqual({ x: 10, y: 10 })
    expect(insetCanvasHandle({ x: 320, y: 240 }, 320, 240)).toEqual({ x: 310, y: 230 })
  })
})
