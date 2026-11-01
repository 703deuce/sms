// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi, type ComponentProps } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TranscriptPanel, type TranscriptSelection } from '@/components/clips/editor/transcript-panel'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'

const bounds = { clipStartMs: 5000, clipEndMs: 15_000, trimMinMs: 0, trimMaxMs: 30_000 }
const words: SourceWord[] = [
  { i: 0, w: 'Before', s: 3.2, e: 3.6 },
  { i: 1, w: 'Inside', s: 6, e: 6.4 },
  { i: 2, w: 'After', s: 18, e: 18.4 },
]

function renderPanel(extra?: Partial<ComponentProps<typeof TranscriptPanel>>) {
  const selectionRef = { current: null as TranscriptSelection | null }
  const onExtendTrim = vi.fn()
  const edits = normalizeEdits(defaultEdits(bounds), bounds)
  const r = render(
    <TranscriptPanel
      words={words}
      shots={[]}
      edits={edits}
      onSeek={vi.fn()}
      onAddCut={vi.fn()}
      onWordFix={vi.fn()}
      onRestoreWord={vi.fn()}
      onExtendTrim={onExtendTrim}
      selectionRef={selectionRef}
      clipStartMs={bounds.clipStartMs}
      clipEndMs={bounds.clipEndMs}
      {...extra}
    />,
  )
  return { onExtendTrim, ...r }
}

describe('transcript show surrounding', () => {
  afterEach(() => cleanup())

  it('off path keeps muted words disabled (no surrounding attrs)', () => {
    renderPanel({ showSurrounding: false })
    const btn = screen.getByText('Before').closest('button')
    expect(btn?.disabled).toBe(true)
    expect(document.querySelector('[data-surrounding="1"]')).toBeNull()
  })

  it('on path line-through extends without confirm', () => {
    const confirm = vi.spyOn(window, 'confirm')
    const { onExtendTrim } = renderPanel({ showSurrounding: true })
    fireEvent.click(screen.getByText('Before'))
    expect(confirm).not.toHaveBeenCalled()
    expect(onExtendTrim).toHaveBeenCalled()
    expect(document.querySelector('[data-surrounding="1"]')).toBeTruthy()
  })

  it('run Restore extends to far edge', () => {
    const { onExtendTrim } = renderPanel({ showSurrounding: true })
    const restores = screen.getAllByText('Restore')
    fireEvent.click(restores[restores.length - 1]!)
    expect(onExtendTrim).toHaveBeenCalledWith(expect.any(Number))
  })
})
