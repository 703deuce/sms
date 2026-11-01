// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi, type ComponentProps } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TranscriptPanel, type TranscriptSelection } from '@/components/clips/editor/transcript-panel'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'

const bounds = { clipStartMs: 0, clipEndMs: 10_000, trimMinMs: 0, trimMaxMs: 10_000 }
const fixtureWords: SourceWord[] = [
  { i: 0, w: 'I', s: 0.0, e: 0.2 },
  { i: 1, w: 'think', s: 0.2, e: 0.5 },
  { i: 2, w: 'above.', s: 0.5, e: 0.9 },
  { i: 3, w: 'Yeah.', s: 1.8, e: 2.1 },
  { i: 4, w: '100%.', s: 2.2, e: 2.8 },
  { i: 5, w: 'Smile.', s: 5.0, e: 5.4 },
]

function renderPanel(
  edits = normalizeEdits(defaultEdits(bounds), bounds),
  extra?: Partial<ComponentProps<typeof TranscriptPanel>>,
) {
  const selectionRef = { current: null as TranscriptSelection | null }
  const onSetEdits = vi.fn()
  const onRestoreCutRange = vi.fn()
  const onSeek = vi.fn()
  const onAddCut = vi.fn()
  const r = render(
    <TranscriptPanel
      words={fixtureWords}
      shots={[]}
      edits={edits}
      onSeek={onSeek}
      onAddCut={onAddCut}
      onWordFix={vi.fn()}
      onRestoreWord={vi.fn()}
      onExtendTrim={vi.fn()}
      onRestoreCutRange={onRestoreCutRange}
      selectionRef={selectionRef}
      clipStartMs={bounds.clipStartMs}
      clipEndMs={bounds.clipEndMs}
      onSetEdits={onSetEdits}
      playheadSourceMs={extra?.playheadSourceMs}
      {...extra}
    />,
  )
  return { ...r, onSetEdits, onRestoreCutRange, onSeek, onAddCut }
}

describe('TBE TranscriptPanel', () => {
  afterEach(() => cleanup())

  it('ignore selection sets wordFixes', () => {
    const { onSetEdits } = renderPanel()
    fireEvent.click(screen.getByText('Yeah.'))
    fireEvent.click(screen.getByText('100%.'), { shiftKey: true })
    fireEvent.click(screen.getByTestId('transcript-ignore'))
    expect(onSetEdits).toHaveBeenCalled()
    const next = onSetEdits.mock.calls[0]![0]
    expect(next.wordFixes['3']).toBe('')
    expect(next.wordFixes['4']).toBe('')
  })

  it('ignored words render data-ignored', () => {
    const edits = normalizeEdits(
      {
        ...defaultEdits(bounds),
        wordFixes: { '3': '', '4': '' },
        wordFixMeta: { '3': { s: 1.8, w: 'Yeah.' }, '4': { s: 2.2, w: '100%.' } },
      },
      bounds,
    )
    renderPanel(edits)
    expect(document.querySelectorAll('[data-ignored="1"]').length).toBe(2)
  })

  it('restore selection calls onRestoreCutRange', () => {
    const edits = normalizeEdits({ ...defaultEdits(bounds), cutRanges: [[1800, 2800]] }, bounds)
    const { onRestoreCutRange } = renderPanel(edits)
    fireEvent.click(screen.getByText('Yeah.'))
    fireEvent.click(screen.getByText('100%.'), { shiftKey: true })
    fireEvent.click(screen.getByTestId('transcript-restore-selection'))
    expect(onRestoreCutRange).toHaveBeenCalledWith([1800, 2800])
  })

  it('collapsed removed run when show deleted off', () => {
    localStorage.setItem('transovo.script.showDeleted', '0')
    const edits = normalizeEdits({ ...defaultEdits(bounds), cutRanges: [[1800, 2800]] }, bounds)
    const { onRestoreCutRange } = renderPanel(edits)
    const run = screen.getByTestId('transcript-removed-run')
    expect(run.textContent).toMatch(/2 words removed/)
    fireEvent.click(run.querySelector('button')!)
    expect(onRestoreCutRange).toHaveBeenCalledWith([1800, 2800])
    localStorage.removeItem('transovo.script.showDeleted')
  })

  it('restore all respects confirm', () => {
    const edits = normalizeEdits({ ...defaultEdits(bounds), cutRanges: [[1800, 2800]] }, bounds)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { onSetEdits } = renderPanel(edits)
    fireEvent.click(screen.getByTestId('transcript-restore-all'))
    expect(onSetEdits).toHaveBeenCalledWith(expect.objectContaining({ cutRanges: [] }))
    confirm.mockReturnValue(false)
    onSetEdits.mockClear()
    fireEvent.click(screen.getByTestId('transcript-restore-all'))
    expect(onSetEdits).not.toHaveBeenCalled()
    confirm.mockRestore()
  })

  it('playhead highlights active word', () => {
    const { rerender } = renderPanel(undefined, { playheadSourceMs: 2300 })
    expect(document.querySelector('[data-word-i="4"][data-active="1"]')).toBeTruthy()
    rerender(
      <TranscriptPanel
        words={fixtureWords}
        shots={[]}
        edits={normalizeEdits(defaultEdits(bounds), bounds)}
        onSeek={vi.fn()}
        onAddCut={vi.fn()}
        onWordFix={vi.fn()}
        onRestoreWord={vi.fn()}
        onExtendTrim={vi.fn()}
        selectionRef={{ current: null }}
        clipStartMs={bounds.clipStartMs}
        clipEndMs={bounds.clipEndMs}
        onSetEdits={vi.fn()}
        playheadSourceMs={1000}
      />,
    )
    expect(document.querySelector('[data-active="1"]')).toBeNull()
  })

  it('speaker rename', () => {
    const { onSetEdits } = renderPanel()
    fireEvent.click(screen.getByTestId('transcript-speaker-chip'))
    const input = screen.getByTestId('transcript-speaker-input')
    fireEvent.change(input, { target: { value: 'Chad' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSetEdits).toHaveBeenCalledWith(expect.objectContaining({ speakerNames: { A: 'Chad' } }))
  })

  it('paragraph breaks before i=3 and i=5', () => {
    renderPanel()
    expect(document.querySelectorAll('[data-testid="transcript-para-break"]').length).toBe(2)
  })
})
