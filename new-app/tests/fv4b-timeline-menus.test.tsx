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
    broll: [
      { id: 'b1', source: 'stock', assetId: 'a1', startMs: 5000, endMs: 8000 },
      { id: 'b2', source: 'ai', generationId: 'g2', startMs: 12000, endMs: 14000 },
    ],
    ...patch,
  }
}

function setup(e: ClipEditsV2 = edits()) {
  const onCommitEdits = vi.fn()
  const utils = render(
    <Timeline
      edits={e}
      words={words}
      shots={[]}
      outputMs={10000}
      clipOutputDurationMs={20000}
      onSeekOutput={vi.fn()}
      clipStartMs={bounds.clipStartMs}
      clipEndMs={bounds.clipEndMs}
      trimMinMs={bounds.trimMinMs}
      trimMaxMs={bounds.trimMaxMs}
      onCommitEdits={onCommitEdits}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
    />,
  )
  const broll = (id: string) =>
    utils.getAllByTestId('timeline-item-broll').find((el) => el.getAttribute('data-item-id') === id)!
  return { ...utils, onCommitEdits, broll }
}

function click(el: Element, shiftKey = false) {
  act(() => {
    fireEvent.pointerDown(el, { button: 0, clientX: 100, pointerId: 1, shiftKey })
  })
  act(() => {
    fireEvent.pointerUp(window, { clientX: 100, pointerId: 1, shiftKey })
  })
}

describe('FV4b takes menus', () => {
  afterEach(() => cleanup())

  it('toolbar Takes menu lists Group as takes, disabled with a hint until 2 clips are selected', () => {
    const { getByTestId } = setup()
    fireEvent.click(getByTestId('timeline-takes-menu'))
    const g = getByTestId('timeline-toolbar-group-takes') as HTMLButtonElement
    expect(g.disabled).toBe(true)
    expect(g.textContent).toMatch(/Select 2\+ clips/)
  })

  it('context menu groups 2 selected B-roll clips, then Takes ▸ next / previous / ungroup', () => {
    const { getByTestId, broll, onCommitEdits } = setup()
    click(broll('b1'))
    click(broll('b2'), true)
    fireEvent.contextMenu(broll('b2'), { clientX: 50, clientY: 50 })
    const g = getByTestId('timeline-group-takes') as HTMLButtonElement
    expect(g.disabled).toBe(false)
    fireEvent.click(g)
    const grouped = onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(grouped.takes?.[0]).toMatchObject({ kind: 'broll', items: ['b1', 'b2'], active: 'b1' })
    // Re-render with the grouped edits and open the menu on the active take.
    cleanup()
    const s2 = setup(grouped)
    click(s2.broll('b1'))
    fireEvent.contextMenu(s2.broll('b1'), { clientX: 50, clientY: 50 })
    fireEvent.click(s2.getByTestId('timeline-takes-submenu'))
    expect(s2.getByTestId('timeline-next-take')).toBeTruthy()
    expect(s2.getByTestId('timeline-prev-take')).toBeTruthy()
    fireEvent.click(s2.getByTestId('timeline-ungroup-takes'))
    const ungrouped = s2.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(ungrouped.takes ?? []).toHaveLength(0)
  })
})

describe('FV4b track motion entry points', () => {
  afterEach(() => cleanup())

  it('overlay (B-roll) and added overlay tracks offer Track motion…', () => {
    const e = edits({ tracks: [{ id: 'ov2', kind: 'overlay' }, { id: 'ov1', kind: 'overlay' }] } as Partial<ClipEditsV2>)
    const { getByTestId, queryByTestId } = setup(e)
    fireEvent.click(getByTestId('timeline-track-menu-broll'))
    expect(getByTestId('timeline-track-motion-broll').textContent).toBe('Track motion…')
    const extra = queryByTestId('timeline-track-menu-broll-ov2')
    if (extra) {
      fireEvent.click(extra)
      expect(getByTestId('timeline-track-motion-broll-ov2')).toBeTruthy()
    }
  })

  it('main Video header menu opens the Main video slot panel', () => {
    const { getByTestId, onCommitEdits } = setup()
    fireEvent.click(getByTestId('timeline-track-menu-video'))
    const item = getByTestId('timeline-track-motion-video')
    expect(item.textContent).toBe('Main video slot…')
    fireEvent.click(item)
    expect(getByTestId('track-motion-panel-main')).toBeTruthy()
    fireEvent.click(getByTestId('track-motion-main-left_half'))
    const next = onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(next.keyframes?.find((k) => k.target === 'video' && k.prop === 'x')?.value).toBe(-25)
    expect(next.trackMotion ?? []).toHaveLength(0)
  })
})
