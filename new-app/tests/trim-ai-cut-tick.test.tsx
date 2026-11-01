// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { CleanupPanel } from '@/components/clips/editor/cleanup-panel'
import { Timeline } from '@/components/clips/editor/timeline'

const bounds = { clipStartMs: 5000, clipEndMs: 15_000, trimMinMs: 0, trimMaxMs: 30_000 }
const words = [{ i: 0, w: 'hi', s: 6, e: 6.5 }]

describe('AI cut ticks', () => {
  afterEach(() => cleanup())

  it('Reset restores AI bounds', () => {
    const onCommitTrim = vi.fn()
    const edits = normalizeEdits(
      { ...defaultEdits(bounds), trim: { in: 4000, out: 16_000 } },
      bounds,
    )
    const { getByTestId } = render(
      <CleanupPanel
        clipId="c1"
        bounds={bounds}
        edits={edits}
        words={words}
        gapSettings={{
          mode: 'more_than',
          minGapSec: 0.6,
          maxGapSec: 3,
          targetGapSec: 0.35,
        }}
        onApplyProposal={vi.fn()}
        onRestoreProposal={vi.fn()}
        onCommitTrim={onCommitTrim}
        onAuditionChange={vi.fn()}
        onSeek={vi.fn()}
      />,
    )
    fireEvent.click(getByTestId('reset-ai-cut'))
    expect(onCommitTrim).toHaveBeenCalledWith({ in: 5000, out: 15_000 })
  })

  it('ticks only when trim differs from clip bounds', () => {
    const trimmed = normalizeEdits(
      { ...defaultEdits(bounds), trim: { in: 4000, out: 16_000 } },
      bounds,
    )
    const atAi = normalizeEdits(defaultEdits(bounds), bounds)
    const base = {
      words,
      shots: [],
      outputMs: 6000,
      clipOutputDurationMs: 10_000,
      onSeekOutput: vi.fn(),
      clipStartMs: bounds.clipStartMs,
      clipEndMs: bounds.clipEndMs,
      trimMinMs: bounds.trimMinMs,
      trimMaxMs: bounds.trimMaxMs,
      onCommitEdits: vi.fn(),
    }
    const moved = render(<Timeline edits={trimmed} {...base} />)
    expect(moved.queryAllByTestId('ai-cut-tick').length).toBe(2)
    moved.unmount()
    const same = render(<Timeline edits={atAi} {...base} />)
    expect(same.queryAllByTestId('ai-cut-tick').length).toBe(0)
  })
})
