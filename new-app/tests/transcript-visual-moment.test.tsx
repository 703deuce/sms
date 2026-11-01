// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TranscriptPanel, type TranscriptSelection } from '@/components/clips/editor/transcript-panel'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import type { VisualMomentRow } from '@/lib/clips/editor/highlights'

const bounds = { clipStartMs: 0, clipEndMs: 60_000, trimMinMs: 0, trimMaxMs: 60_000 }

describe('transcript visual moment', () => {
  afterEach(() => cleanup())

  it('renders row and calls seek + select', () => {
    const onSeek = vi.fn()
    const onSelectRange = vi.fn()
    const momentRows: VisualMomentRow[] = [
      {
        beforeWordIndex: 0,
        pick: {
          clipId: 'c1',
          title: 'Goal',
          startMs: 5000,
          endMs: 8000,
          score: 90,
          reasonTag: 'visual',
          why: 'Amazing goal',
        },
        label: '▶ Visual moment · 0:05–0:08 · Amazing goal',
      },
    ]
    const selectionRef = { current: null as TranscriptSelection | null }
    render(
      <TranscriptPanel
        words={[{ i: 0, w: 'Hi', s: 10, e: 10.5 }]}
        shots={[]}
        edits={normalizeEdits(defaultEdits(bounds), bounds)}
        onSeek={onSeek}
        onAddCut={vi.fn()}
        onWordFix={vi.fn()}
        onRestoreWord={vi.fn()}
        onExtendTrim={vi.fn()}
        selectionRef={selectionRef}
        clipStartMs={bounds.clipStartMs}
        clipEndMs={bounds.clipEndMs}
        momentRows={momentRows}
        onSelectRange={onSelectRange}
      />,
    )
    fireEvent.click(screen.getByTestId('transcript-visual-moment'))
    expect(onSeek).toHaveBeenCalledWith(5000)
    expect(onSelectRange).toHaveBeenCalledWith(5000, 8000)
  })
})
