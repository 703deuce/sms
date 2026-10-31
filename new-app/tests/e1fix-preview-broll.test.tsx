// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, render } from '@testing-library/react'
import { PreviewStage } from '@/components/clips/editor/preview-stage'
import { normalizeEdits } from '@/lib/clips/edits'
import type { BrollMediaRow } from '@/lib/server/clips/broll-media'

/**
 * E1fix bug 2: B-roll inserted after the editor loaded showed on the timeline and in the export,
 * but the preview kept the original video. The rAF tick read the `brollMedia` prop from its first
 * render ([] deps), so a media row added later was never found and the B-roll stayed at opacity 0.
 */
const bounds = { clipStartMs: 0, clipEndMs: 30000 }
const ITEM = { id: 'b1', source: 'stock', assetId: 'a1', startMs: 0, endMs: 3000, placement: 'manual' } as const
const MEDIA: BrollMediaRow = {
  id: 'b1',
  source: 'stock',
  startMs: 0,
  endMs: 3000,
  url: 'https://example.com/broll.mp4',
  assetId: 'a1',
} as BrollMediaRow

function edits(layoutMode = 'center_crop') {
  return normalizeEdits(
    {
      v: 2,
      trim: { in: 0, out: 30000 },
      layout: { mode: layoutMode, shotOverrides: [] },
      broll: [ITEM],
      captions: { enabled: true },
      cutRanges: [],
      wordFixes: {},
      aspectRatio: '9:16',
    },
    bounds,
  )
}

async function frames(n = 4) {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
  }
}

describe('PreviewStage B-roll (E1fix)', () => {
  afterEach(() => cleanup())

  it('shows B-roll whose media row arrives after mount (live insert)', async () => {
    const videoRef = { current: null }
    const props = {
      videoUrl: 'https://example.com/video.mp4',
      words: [],
      cropTrack: null,
      videoRef,
      onTick: vi.fn(),
      testBoxSize: { w: 270, h: 480 },
    }
    const view = render(<PreviewStage {...props} edits={edits()} brollMedia={[]} />)
    await frames()
    expect(view.container.querySelector(`video[src="${MEDIA.url}"]`)).toBeNull()
    view.rerender(<PreviewStage {...props} edits={edits()} brollMedia={[MEDIA]} />)
    await frames()
    const vid = view.container.querySelector(`video[src="${MEDIA.url}"]`) as HTMLVideoElement
    expect(vid).toBeTruthy()
    // playhead at 0 ms is inside the 0–3000 ms window -> visible (was stuck at '0')
    expect(vid.style.opacity).toBe('1')
    // B-roll sits under captions / title (z-24..26) like the export, above the main video
    const wrap = vid.closest('[data-testid="preview-broll"]') as HTMLElement
    expect(wrap.className).toContain('z-[15]')
  })

  it('fit_top: B-roll covers the video area under the headline band, like the export compose', async () => {
    const raw = JSON.parse(readFileSync(join(__dirname, 'fixtures/export-dialog-edits/stream_v3_clipB.json'), 'utf8'))
    const b = { clipStartMs: 0, clipEndMs: 60_000, trimMinMs: 0, trimMaxMs: 120_000 }
    const e = normalizeEdits({ ...raw, broll: [{ ...ITEM, startMs: 5000, endMs: 8000 }] }, b)
    e.layout.mode = 'fit_top'
    const { container } = render(
      <PreviewStage
        videoUrl="https://example.com/v.mp4"
        edits={e}
        words={[]}
        cropTrack={null}
        videoRef={{ current: null }}
        onTick={() => {}}
        brollMedia={[{ ...MEDIA, startMs: 5000, endMs: 8000 }]}
        testBoxSize={{ w: 360, h: 640 }}
      />,
    )
    const main = container.querySelector('[data-testid="fit-top-main-video"]') as HTMLElement
    const wrap = container.querySelector('[data-testid="preview-broll"]') as HTMLElement
    expect(main && wrap).toBeTruthy()
    expect(Number.parseFloat(wrap.style.top)).toBeCloseTo(Number.parseFloat(main.style.top), 3)
    expect(Number.parseFloat(wrap.style.top)).toBeGreaterThan(0)
    expect(Number.parseFloat(wrap.style.height)).toBeCloseTo(Number.parseFloat(main.style.height), 3)
  })

  it('a layout switch that remounts the main <video> keeps the playhead (was reset to 0:00)', async () => {
    const videoRef = { current: null as HTMLVideoElement | null }
    const props = {
      videoUrl: 'https://example.com/video.mp4',
      words: [],
      cropTrack: null,
      videoRef,
      onTick: vi.fn(),
      testBoxSize: { w: 270, h: 480 },
      brollMedia: [] as BrollMediaRow[],
    }
    const view = render(<PreviewStage {...props} edits={edits('center_crop')} />)
    const first = videoRef.current as HTMLVideoElement
    expect(first).toBeTruthy()
    first.currentTime = 7.25
    await frames()
    view.rerender(<PreviewStage {...props} edits={edits('fit_blur')} />)
    await frames(2)
    const second = videoRef.current as HTMLVideoElement
    expect(second).toBeTruthy()
    expect(second).not.toBe(first)
    second.dispatchEvent(new Event('loadedmetadata'))
    expect(second.currentTime).toBeCloseTo(7.25, 2)
  })
})
