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
})
