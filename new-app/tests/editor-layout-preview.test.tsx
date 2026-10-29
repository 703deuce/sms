// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { PreviewStage } from '@/components/clips/editor/preview-stage'
import { ExportTemplateOverlay } from '@/components/clips/export-template-overlay'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { overlayLayout } from '@/lib/clips/stream-overlay-layout'
import { fitTopHeadlineLines } from '@/lib/clips/fit-top-headline-lines'
import type { CropTrack } from '@/lib/clips/crop-track'

const streamCropTrack: CropTrack = {
  v: 2,
  W: 1920,
  H: 1080,
  cw: 607,
  fps: 30,
  t0_ms: 5000,
  x0: [656],
  x0_A: [656],
  x0_B: [656],
  shots: [{ start_ms: 5000, end_ms: 35000, spk: 'A' }],
}

const bounds = { clipStartMs: 0, clipEndMs: 60_000, trimMinMs: 0, trimMaxMs: 120_000 }

function loadFixture(name: string): ClipEditsV2 {
  const raw = JSON.parse(readFileSync(join(__dirname, 'fixtures/export-dialog-edits', name), 'utf8'))
  if (name === 'regular.json') return normalizeEdits(defaultEdits(bounds), bounds)
  return normalizeEdits(raw, bounds)
}

describe('PreviewStage layout geometry', () => {
  for (const mode of ['fit_top', 'center_crop', 'fit_blur', 'speaker_follow'] as const) {
    it(`renders ${mode} without throw`, () => {
      for (const file of ['regular.json', 'stream_v3_clipB.json'] as const) {
        const edits = loadFixture(file)
        edits.layout.mode = mode
        expect(() =>
          render(
            <PreviewStage
              videoUrl="https://example.com/v.mp4"
              edits={edits}
              words={[]}
              cropTrack={null}
              videoRef={{ current: null }}
              onTick={() => {}}
              testBoxSize={{ w: 360, h: 640 }}
            />,
          ),
        ).not.toThrow()
      }
    })
  }

  it('fit_top main video top aligns with overlay headline band', () => {
    const edits = loadFixture('stream_v3_clipB.json')
    edits.layout.mode = 'fit_top'
    const lines = fitTopHeadlineLines(edits)
    const lay = overlayLayout(Math.max(2, lines.length || 2))
    const sy = 640 / lay.playH
    const expectedTop = lay.videoY * sy
    const { container } = render(
      <>
        <PreviewStage
          videoUrl="https://example.com/v.mp4"
          edits={edits}
          words={[]}
          cropTrack={null}
          videoRef={{ current: null }}
          onTick={() => {}}
          testBoxSize={{ w: 360, h: 640 }}
        />
        <ExportTemplateOverlay edits={edits} boxWidth={360} boxHeight={640} />
      </>,
    )
    const main = container.querySelector('[data-testid="fit-top-main-video"]') as HTMLElement | null
    expect(main).toBeTruthy()
    const topPx = Number.parseFloat(main!.style.top)
    expect(Math.abs(topPx - expectedTop)).toBeLessThanOrEqual(1)
  })

  it('center_crop uses object-cover', () => {
    const edits = loadFixture('regular.json')
    edits.layout.mode = 'center_crop'
    const { container } = render(
      <PreviewStage
        videoUrl="https://example.com/v.mp4"
        edits={edits}
        words={[]}
        cropTrack={null}
        videoRef={{ current: null }}
        onTick={() => {}}
        testBoxSize={{ w: 360, h: 640 }}
      />,
    )
    const vid = container.querySelector('[data-testid="center-crop-video"]')
    expect(vid?.className).toContain('object-cover')
  })

  it('center_crop fill geometry differs from fit_top (stream + crop track)', () => {
    const editsFitTop = loadFixture('stream_v3_clipB.json')
    editsFitTop.layout.mode = 'fit_top'
    const lines = fitTopHeadlineLines(editsFitTop)
    const lay = overlayLayout(Math.max(2, lines.length || 2))
    const sy = 640 / lay.playH
    const expectedTop = lay.videoY * sy

    const { container: fitTopDom, unmount } = render(
      <PreviewStage
        videoUrl="https://example.com/v.mp4"
        edits={editsFitTop}
        words={[]}
        cropTrack={streamCropTrack}
        videoRef={{ current: null }}
        onTick={() => {}}
        testBoxSize={{ w: 360, h: 640 }}
      />,
    )
    const fitTopVid = fitTopDom.querySelector('[data-testid="fit-top-main-video"]') as HTMLElement | null
    expect(fitTopVid).toBeTruthy()
    const fitTopTop = Number.parseFloat(fitTopVid!.style.top)
    expect(fitTopTop).toBeGreaterThan(8)
    expect(Math.abs(fitTopTop - expectedTop)).toBeLessThanOrEqual(2)
    unmount()

    const editsFill = loadFixture('stream_v3_clipB.json')
    editsFill.layout.mode = 'center_crop'
    const { container: fillDom } = render(
      <PreviewStage
        videoUrl="https://example.com/v.mp4"
        edits={editsFill}
        words={[]}
        cropTrack={streamCropTrack}
        videoRef={{ current: null }}
        onTick={() => {}}
        testBoxSize={{ w: 360, h: 640 }}
      />,
    )
    const fillVid = fillDom.querySelector('[data-testid="center-crop-video"]') as HTMLElement | null
    expect(fillVid).toBeTruthy()
    expect(fillVid!.className).toContain('object-cover')
    const fillTop = fillVid!.style.top
    expect(fillTop === '' || fillTop === '0px').toBe(true)
    expect(fitTopDom.querySelector('[data-testid="center-crop-video"]')).toBeNull()
  })
})
