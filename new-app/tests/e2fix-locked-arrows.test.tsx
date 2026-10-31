// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), message: vi.fn() }) }))

import { Timeline } from '@/components/clips/editor/timeline'
import { arrowStepMs, setLaneState } from '@/lib/clips/editor/clip-timeline'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }

function edits(locked: boolean): ClipEditsV2 {
  const e: ClipEditsV2 = {
    ...normalizeEdits(defaultEdits(bounds), bounds),
    loopFriendlyEnd: false,
    broll: [{ id: 'b1', source: 'stock', assetId: 'a1', startMs: 500, endMs: 3000 }],
  }
  return locked ? setLaneState(e, 'broll', { locked: true }) : e
}

function setup(locked: boolean) {
  const onCommitEdits = vi.fn()
  const windowKey = vi.fn()
  window.addEventListener('keydown', windowKey)
  const r = render(
    <Timeline
      edits={edits(locked)}
      words={[]}
      shots={[]}
      outputMs={1000}
      clipOutputDurationMs={20000}
      onSeekOutput={() => {}}
      clipStartMs={0}
      clipEndMs={20000}
      onCommitEdits={onCommitEdits}
    />,
  )
  const broll = r.getAllByTestId('timeline-item-broll')[0]!
  const cleanupKey = () => window.removeEventListener('keydown', windowKey)
  return { ...r, onCommitEdits, windowKey, broll, cleanupKey }
}

describe('E2fix: arrow keys and locked lanes', () => {
  afterEach(() => cleanup())

  it('Shift+Right after clicking a LOCKED B-roll item does nothing (no nudge, no playhead step)', () => {
    const s = setup(true)
    act(() => {
      fireEvent.pointerDown(s.broll, { button: 0, clientX: 10 })
      fireEvent.pointerUp(window, { clientX: 10 })
    })
    fireEvent.keyDown(s.getByTestId('timeline-scroll'), { key: 'ArrowRight', shiftKey: true })
    expect(s.onCommitEdits).not.toHaveBeenCalled()
    expect(s.windowKey).not.toHaveBeenCalled() // the editor's playhead step never sees it
    s.cleanupKey()
  })

  it('with nothing selected, arrows bubble to the editor (playhead step); unlocked selection nudges', () => {
    const s = setup(false)
    fireEvent.keyDown(s.getByTestId('timeline-scroll'), { key: 'ArrowRight' })
    expect(s.windowKey).toHaveBeenCalledTimes(1)
    act(() => {
      fireEvent.pointerDown(s.broll, { button: 0, clientX: 10 })
      fireEvent.pointerUp(window, { clientX: 10 })
    })
    fireEvent.keyDown(s.getByTestId('timeline-scroll'), { key: 'ArrowRight', shiftKey: true })
    expect((s.onCommitEdits.mock.calls[0]![0] as ClipEditsV2).broll![0]).toMatchObject({ startMs: 830 })
    expect(s.windowKey).toHaveBeenCalledTimes(1)
    s.cleanupKey()
  })

  it('one step size for items and playhead: 1 frame, Shift = 10 frames', () => {
    expect(arrowStepMs(false)).toBe(33)
    expect(arrowStepMs(true)).toBe(330)
  })
})
