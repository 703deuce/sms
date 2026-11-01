// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { Timeline } from '@/components/clips/editor/timeline'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const words = Array.from({ length: 30 }, (_, i) => ({ i, w: `w${i}`, s: i * 0.6, e: i * 0.6 + 0.4 }))

function edits(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return {
    ...normalizeEdits(defaultEdits(bounds), bounds),
    loopFriendlyEnd: false,
    cutRanges: [[3000, 4000]],
    broll: [
      { id: 'b1', source: 'stock', assetId: 'a1', startMs: 5000, endMs: 8000 },
      { id: 'b2', source: 'ai', generationId: 'g2', startMs: 12000, endMs: 14000 },
    ],
    audio: { music: { generationId: 'm1' }, sfx: [{ generationId: 's1', atMs: 9000 }] },
    ...patch,
  }
}

function setup(e: ClipEditsV2 = edits(), extra: Record<string, unknown> = {}) {
  const onCommitEdits = vi.fn()
  const onSeekOutput = vi.fn()
  const onUndo = vi.fn()
  const onRedo = vi.fn()
  const utils = render(
    <Timeline
      edits={e}
      words={words}
      shots={[]}
      outputMs={10000}
      clipOutputDurationMs={19000}
      onSeekOutput={onSeekOutput}
      clipStartMs={bounds.clipStartMs}
      clipEndMs={bounds.clipEndMs}
      trimMinMs={bounds.trimMinMs}
      trimMaxMs={bounds.trimMaxMs}
      onCommitEdits={onCommitEdits}
      onUndo={onUndo}
      onRedo={onRedo}
      canUndo
      {...extra}
    />,
  )
  const pxPerMs = () => parseFloat(utils.getByTestId('timeline-track').style.width) / 19000
  const broll = (id: string) =>
    utils.getAllByTestId('timeline-item-broll').find((el) => el.getAttribute('data-item-id') === id)!
  return { ...utils, onCommitEdits, onSeekOutput, onUndo, onRedo, pxPerMs, broll }
}

function drag(el: Element, dxPx: number, opts: { altKey?: boolean } = {}) {
  act(() => {
    fireEvent.pointerDown(el, { button: 0, clientX: 100, pointerId: 1 })
  })
  act(() => {
    fireEvent.pointerMove(window, { clientX: 100 + dxPx, pointerId: 1, altKey: opts.altKey })
  })
  act(() => {
    fireEvent.pointerUp(window, { clientX: 100 + dxPx, pointerId: 1 })
  })
}

describe('G1b3 timeline tools', () => {
  afterEach(() => cleanup())

  it('R / U / V switch the trim tool; roll on the main cut keeps the length', () => {
    const { getByTestId, getAllByTestId, pxPerMs, onCommitEdits } = setup()
    fireEvent.keyDown(getByTestId('timeline-scroll'), { key: 'r' })
    expect(getByTestId('timeline-tool-roll').getAttribute('aria-pressed')).toBe('true')
    const first = getAllByTestId('timeline-item-video')[0]!
    drag(first.querySelector('[data-testid="timeline-trim-end"]')!, 500 * pxPerMs(), { altKey: true })
    const next = onCommitEdits.mock.calls[0]![0] as ClipEditsV2
    expect(next.cutRanges).toEqual([[3500, 4500]])
    fireEvent.keyDown(getByTestId('timeline-scroll'), { key: 'u' })
    expect(getByTestId('timeline-tool-slide').getAttribute('aria-pressed')).toBe('true')
    fireEvent.keyDown(getByTestId('timeline-scroll'), { key: 'Escape' })
    expect(getByTestId('timeline-tool-select').getAttribute('aria-pressed')).toBe('true')
  })

  it('Alt-drag of a Voice edge at a cut stores a J / L split (picture unchanged)', () => {
    const { getAllByTestId, pxPerMs, onCommitEdits } = setup()
    const v0 = getAllByTestId('timeline-item-voice')[0]!
    drag(v0.querySelector('[data-testid="timeline-trim-end"]')!, 400 * pxPerMs(), { altKey: true })
    const next = onCommitEdits.mock.calls[0]![0] as ClipEditsV2
    expect(next.splitEdits).toEqual([{ atMs: 4000, audioMs: 400 }])
    expect(next.cutRanges).toEqual([[3000, 4000]])
  })

  it('Freeze adds a freeze-frame insert at the playhead', () => {
    const { getByTestId, onCommitEdits } = setup()
    fireEvent.click(getByTestId('timeline-freeze'))
    const next = onCommitEdits.mock.calls[0]![0] as ClipEditsV2
    expect(next.inserts?.[0]).toMatchObject({ sourceId: 'freeze', atSrcMs: 11000, durMs: 3000 })
  })

  it('TL-32: Freeze uses playheadOutMsRef when outputMs prop is stale', () => {
    const playheadOutMsRef = { current: 3000 }
    const { getByTestId, onCommitEdits } = setup(edits(), { outputMs: 22000, playheadOutMsRef })
    fireEvent.click(getByTestId('timeline-freeze'))
    const ins = (onCommitEdits.mock.calls[0]![0] as ClipEditsV2).inserts?.[0]
    expect(ins?.sourceId).toBe('freeze')
    // output 3000 → source ~4000 with default cut fixture; stale prop 22000 would land near ~23000 source.
    expect(ins?.atSrcMs).toBeLessThan(10000)
  })
})
