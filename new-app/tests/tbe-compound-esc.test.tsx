// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { Timeline } from '@/components/clips/editor/timeline'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'

vi.mock('@/components/clips/editor/audio-waveform-lane', () => ({
  AudioWaveformLane: () => null,
}))

const bounds = { clipStartMs: 0, clipEndMs: 30_000, trimMinMs: 0, trimMaxMs: 60_000 }
const words = Array.from({ length: 40 }, (_, i) => ({ i, w: `word${i}`, s: i * 0.6, e: i * 0.6 + 0.4 }))

function compoundEdits() {
  return normalizeEdits(
    {
      ...defaultEdits(bounds),
      broll: [
        { id: 'b1', source: 'upload', uploadId: 'u1', startMs: 0, endMs: 3000 },
        { id: 'b2', source: 'upload', uploadId: 'u2', startMs: 3000, endMs: 6000 },
      ],
      groups: [{ id: 'c1', items: ['broll:b1', 'broll:b2'], compound: { name: 'Compound 1' } }],
    },
    bounds,
  )
}

function renderTimeline(onSelectionChange = vi.fn()) {
  const onCommitEdits = vi.fn()
  const r = render(
    <Timeline
      edits={compoundEdits()}
      words={words}
      shots={[]}
      outputMs={1500}
      clipOutputDurationMs={30000}
      onSeekOutput={vi.fn()}
      clipStartMs={bounds.clipStartMs}
      clipEndMs={bounds.clipEndMs}
      onCommitEdits={onCommitEdits}
      onSelectionChange={onSelectionChange}
    />,
  )
  return { ...r, onCommitEdits, onSelectionChange }
}

describe('TBE Part A: compound Esc', () => {
  afterEach(() => cleanup())

  it('first Esc closes compound opened from ctx menu with body focus', async () => {
    const { getByTestId, queryByTestId } = renderTimeline()
    const block = getByTestId('timeline-compound')
    fireEvent.contextMenu(block)
    fireEvent.click(getByTestId('timeline-ctx-open-compound'))
    expect(getByTestId('timeline-compound-banner')).toBeTruthy()
    document.body.focus()
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    await waitFor(() => expect(queryByTestId('timeline-compound-banner')).toBeNull())
  })

  it('Esc on timeline root clears selection and closes compound', () => {
    const onSelectionChange = vi.fn()
    const { getByTestId, queryByTestId } = renderTimeline(onSelectionChange)
    const block = getByTestId('timeline-compound')
    fireEvent.contextMenu(block)
    fireEvent.click(getByTestId('timeline-ctx-open-compound'))
    fireEvent.pointerDown(block)
    const root = getByTestId('timeline-root')
    root.focus()
    fireEvent.keyDown(root, { key: 'Escape' })
    expect(queryByTestId('timeline-compound-banner')).toBeNull()
    expect(onSelectionChange).toHaveBeenCalledWith(null)
  })

  it('Esc in text input does not close compound', () => {
    const { getByTestId, container } = renderTimeline()
    const block = getByTestId('timeline-compound')
    fireEvent.contextMenu(block)
    fireEvent.click(getByTestId('timeline-ctx-open-compound'))
    const input = document.createElement('input')
    container.querySelector('[data-testid="timeline-root"]')!.appendChild(input)
    input.focus()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(getByTestId('timeline-compound-banner')).toBeTruthy()
  })

  it('Esc closes ctx menu first then compound on second press', async () => {
    const { getByTestId, queryByTestId, getAllByTestId } = renderTimeline()
    const block = getByTestId('timeline-compound')
    fireEvent.contextMenu(block)
    fireEvent.click(getByTestId('timeline-ctx-open-compound'))
    expect(getByTestId('timeline-compound-banner')).toBeTruthy()
    const inner = getAllByTestId('timeline-item-broll')[0]!
    fireEvent.contextMenu(inner, { clientX: 120, clientY: 120 })
    await waitFor(() => expect(document.querySelector('[role="menu"]')).toBeTruthy())
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    await waitFor(() => expect(document.querySelector('[role="menu"]')).toBeNull())
    expect(getByTestId('timeline-compound-banner')).toBeTruthy()
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(queryByTestId('timeline-compound-banner')).toBeNull()
  })
})
