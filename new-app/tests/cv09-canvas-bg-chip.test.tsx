// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { defaultEdits } from '@/lib/clips/edits'
import { withCanvasBg } from '@/lib/clips/canvas-bg'
import { CanvasBackgroundChip } from '@/components/clips/editor/canvas-background'
import { PreviewChipRow } from '@/components/clips/editor/preview-chip-row'
import { floatToolbarTop } from '@/components/clips/editor/canvas-selection-overlay'

const bounds = { clipStartMs: 0, clipEndMs: 10_000 }
const mediaStub = { items: [], refresh: async () => {}, upload: async () => ({ id: 'x' }) }

describe('CV09fix canvas bg chip row', () => {
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
    expect(row.contains(chip)).toBe(true)
    expect(chip.className).toContain('whitespace-nowrap')
    expect(chip.className).not.toMatch(/right-\[11\.5rem\]|\babsolute\b/)
    fireEvent.click(chip)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('float toolbar never lands in the bottom chip band for a full-frame selection', () => {
    expect(floatToolbarTop({ x: 0, y: 0, w: 226, h: 402 }, 402)).toBeLessThanOrEqual(402 - 32 - 26)
  })
})
