// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { TranscriptPanel } from '@/components/clips/editor/transcript-panel'
import { defaultEdits } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'

afterEach(cleanup)

describe('A1 transcript Cut uses absolute source time', () => {
  it('cuts exactly the selected 0:44 words, never a same-duration range at 0:00', () => {
    const words: SourceWord[] = [
      { i: 0, w: 'before', s: 43.8, e: 43.95 },
      { i: 1, w: 'go', s: 44, e: 44.2 },
      { i: 2, w: 'through', s: 44.22, e: 44.5 },
      { i: 3, w: 'after', s: 44.7, e: 44.9 },
    ]
    const edits = defaultEdits({ clipStartMs: 0, clipEndMs: 60_000 })
    const onAddCut = vi.fn()
    const view = render(
      <TranscriptPanel
        words={words}
        shots={[]}
        edits={edits}
        onSeek={vi.fn()}
        onAddCut={onAddCut}
        onWordFix={vi.fn()}
        onRestoreWord={vi.fn()}
        onExtendTrim={vi.fn()}
        selectionRef={{ current: null }}
        panelActive
      />,
    )
    fireEvent.click(view.getByTestId('transcript-find-replace')) // preserve toolbar mounting
    fireEvent.click(view.container.querySelector('[data-word-i="1"]')!)
    fireEvent.click(view.container.querySelector('[data-word-i="2"]')!, { shiftKey: true })
    fireEvent.click(view.getByRole('button', { name: 'Cut' }))
    expect(onAddCut).toHaveBeenCalledTimes(1)
    expect(onAddCut).toHaveBeenCalledWith([44_000, 44_500])

    view.rerender(
      <TranscriptPanel
        words={words}
        shots={[]}
        edits={{ ...edits, cutRanges: [[44_000, 44_500]] }}
        onSeek={vi.fn()}
        onAddCut={onAddCut}
        onWordFix={vi.fn()}
        onRestoreWord={vi.fn()}
        onExtendTrim={vi.fn()}
        selectionRef={{ current: null }}
        panelActive
      />,
    )
    expect(view.container.querySelector('[data-word-i="1"]')?.className).toContain('line-through')
    expect(view.container.querySelector('[data-word-i="2"]')?.className).toContain('line-through')
    expect(view.container.querySelector('[data-word-i="3"]')?.className).not.toContain('line-through')
  })
})
