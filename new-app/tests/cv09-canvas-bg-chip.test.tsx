// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { defaultEdits } from '@/lib/clips/edits'
import { CANVAS_BG_LABELS, withCanvasBg } from '@/lib/clips/canvas-bg'
import {
  CanvasBackgroundChip,
  CanvasBackgroundControls,
  canvasBgChipLabel,
} from '@/components/clips/editor/canvas-background'
import { PreviewChipRow } from '@/components/clips/editor/preview-chip-row'
import { floatToolbarTop } from '@/components/clips/editor/canvas-selection-overlay'

const bounds = { clipStartMs: 0, clipEndMs: 10_000 }
const mediaStub = { items: [], refresh: async () => {}, uploadFiles: async () => [] }

describe('CV09fix canvas bg chip row', () => {
  afterEach(() => cleanup())

  it('background chip lives in the nowrap chip row above the selection overlay', () => {
    render(
      <div className="relative" style={{ width: 226, height: 402 }}>
        <PreviewChipRow>
          <CanvasBackgroundChip
            edits={withCanvasBg(defaultEdits(bounds), { type: 'color', color: '#3B82F6' })}
            media={mediaStub as never}
            projectId="p"
            clipId="c"
            visible
            compositeLocked={false}
            readOnly={false}
            onCommit={() => {}}
            narrow
          />
        </PreviewChipRow>
      </div>,
    )
    const row = screen.getByTestId('preview-chip-row')
    const chip = screen.getByRole('button', { name: /background/i })
    expect(row.className).toMatch(/z-\[(4[1-9]|[5-9]\d)\]/)
    expect(row.className).toContain('flex-nowrap')
    expect(row.contains(chip)).toBe(true)
    expect(chip.className).toContain('whitespace-nowrap')
    expect(chip.className).not.toMatch(/right-\[11\.5rem\]|\babsolute\b/)
    fireEvent.click(chip)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('float toolbar never lands in the bottom chip band for a full-frame selection', () => {
    expect(floatToolbarTop({ x: 0, y: 0, w: 226, h: 402 }, 402)).toBeLessThanOrEqual(402 - 32 - 26)
  })

  it('CV09fix2: BG chip can shrink on a narrow row', () => {
    render(
      <div className="relative overflow-hidden" style={{ width: 226 }}>
        <PreviewChipRow>
          <CanvasBackgroundChip
            edits={withCanvasBg(defaultEdits(bounds), { type: 'none' })}
            media={mediaStub as never}
            visible
            compositeLocked={false}
            onCommit={() => {}}
            narrow
          />
        </PreviewChipRow>
      </div>,
    )
    const chip = screen.getByTestId('preview-canvas-bg-chip')
    expect(chip.className).toMatch(/\bmin-w-0\b/)
    expect(chip.className).not.toMatch(/\bshrink-0\b/)
  })

  it.each(['none', 'color', 'blur', 'image'] as const)('CV09fix2: narrow label is BG: <type> for %s', (type) => {
    const bg =
      type === 'color'
        ? { type, color: '#3B82F6' }
        : type === 'image'
          ? { type, imageId: 'u1' }
          : type === 'blur'
            ? { type, blur: 'medium' as const }
            : { type }
    const e = withCanvasBg(defaultEdits(bounds), bg as never)
    expect(canvasBgChipLabel(e, true)).toBe(`BG: ${CANVAS_BG_LABELS[type]}`)
    expect(canvasBgChipLabel(e, false)).toBe(`Background: ${CANVAS_BG_LABELS[type]}`)
  })

  it('CV09fix2: legacy default label is BG: Blur when narrow', () => {
    expect(canvasBgChipLabel(defaultEdits(bounds), true)).toBe('BG: Blur')
  })

  it('CV09fix2: Image tab opens picker with Upload tile when no image chosen', () => {
    render(
      <CanvasBackgroundControls
        edits={withCanvasBg(defaultEdits(bounds), { type: 'color', color: '#000000' })}
        media={mediaStub as never}
        onCommit={vi.fn()}
        compact
      />,
    )
    const controls = screen.getByTestId('canvas-bg-controls')
    fireEvent.click(within(controls).getByRole('button', { name: 'Image' }))
    expect(within(controls).getByRole('button', { name: 'Image' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(controls).getByRole('button', { name: /upload/i })).toBeTruthy()
    expect(within(controls).getByText('Upload an image')).toBeTruthy()
  })

  it('CV09fix2: Image tab lists only uploaded images and picking commits', () => {
    const onCommit = vi.fn()
    const items = [
      {
        id: 'a',
        ref: 'upload' as const,
        refId: 'u1',
        mediaType: 'image' as const,
        label: 'a.png',
        url: 'https://x/a.png',
        durationMs: null,
        width: 1,
        height: 1,
        syncMs: null,
        syncStatus: 'none' as const,
      },
      {
        id: 'b',
        ref: 'upload' as const,
        refId: 'u2',
        mediaType: 'video' as const,
        label: 'b.mp4',
        url: null,
        durationMs: 1,
        width: 1,
        height: 1,
        syncMs: null,
        syncStatus: 'none' as const,
      },
    ]
    const { container } = render(
      <CanvasBackgroundControls
        edits={defaultEdits(bounds)}
        media={{ items, uploadFiles: async () => [] } as never}
        onCommit={onCommit}
        compact
      />,
    )
    const controls = screen.getByTestId('canvas-bg-controls')
    fireEvent.click(within(controls).getByRole('button', { name: 'Image' }))
    const thumbs = container.querySelectorAll('[data-testid="canvas-bg-controls"] .grid-cols-3 > button')
    expect(thumbs.length).toBe(2)
    fireEvent.click(thumbs[0]!)
    expect(onCommit.mock.calls[0][0].canvasBg).toEqual({ type: 'image', imageId: 'u1' })
  })
})
