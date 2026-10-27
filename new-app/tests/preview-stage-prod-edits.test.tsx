// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { CaptionOverlay } from '@/components/clips/editor/caption-overlay'
import { PreviewStage } from '@/components/clips/editor/preview-stage'
import { normalizeEdits } from '@/lib/clips/edits'
import type { CropTrack } from '@/lib/clips/crop-track'

const PROD_EDITS = {
  v: 2,
  trim: { in: 20305, out: 58345 },
  zoom: { enabled: false, intensity: 1.08 },
  audio: { sfx: [], music: null, studioSound: null },
  broll: [
    {
      id: '55f7cc98-a391-4b44-b032-67ca270d2d80',
      endMs: 15000,
      source: 'stock',
      assetId: 'cmvqncsy20000n154xatyxp93',
      startMs: 12000,
      placement: 'auto',
    },
  ],
  layout: { mode: 'center_crop', shotOverrides: [] },
  captions: {
    case: 'sentence',
    size: 6.5,
    enabled: true,
    position: 'top',
    presetId: 'bold_pop',
    animation: 'pop',
    wordsPerLine: 3,
  },
  cutRanges: [],
  wordFixes: {},
  aspectRatio: '9:16',
  silenceTrim: { keepMs: 150, enabled: true, minGapMs: 600 },
} as const

const bounds = { clipStartMs: 20305, clipEndMs: 58345 }

const cropTrack: CropTrack = {
  v: 2,
  W: 1920,
  H: 1080,
  cw: 607,
  fps: 30,
  t0_ms: 20305,
  x0: [656],
  x0_A: [656],
  x0_B: [656],
  shots: [{ start_ms: 20305, end_ms: 58345, spk: 'A' }],
}

describe('PreviewStage prod clip edits', () => {
  it('renders without throwing', () => {
    const edits = normalizeEdits(PROD_EDITS, bounds)
    const onTick = vi.fn()
    const videoRef = { current: null }
    const words = [
      { i: 0, w: 'hello', s: 20.5, e: 21.0 },
      { i: 1, w: 'world', s: 21.0, e: 21.5 },
    ]
    expect(() =>
      render(
        <PreviewStage
          videoUrl="https://example.com/video.mp4"
          edits={edits}
          words={words}
          cropTrack={cropTrack}
          brollMedia={[]}
          videoRef={videoRef}
          onTick={onTick}
        />,
      ),
    ).not.toThrow()
  })

  it('CaptionOverlay tolerates undefined word text', () => {
    const edits = normalizeEdits(PROD_EDITS, bounds)
    const words = [{ w: undefined as unknown as string, s: 0, e: 5, idx: 0 }]
    expect(() =>
      render(
        <CaptionOverlay words={words} currentTimeSec={1} edits={edits} boxHeightPx={400} outputDurationSec={38} />,
      ),
    ).not.toThrow()
  })
})
