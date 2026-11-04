// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { LayersPanel } from '@/components/clips/editor/layers-panel'
import { defaultEdits } from '@/lib/clips/edits'
import { newTextItem } from '@/lib/clips/editor/text-items'
import { visualStack } from '@/lib/clips/editor/tracks'

afterEach(cleanup)

describe('actual Layers stack (E5)', () => {
  it('E5: exposes video visibility/lock and makes real layers the default surface', () => {
    const edits = defaultEdits({ clipStartMs: 0, clipEndMs: 30_000 })
    const onEdits = vi.fn()
    const ui = render(
      <LayersPanel clipId="clip1" edits={edits} layers={[]} setLayers={vi.fn()} onEdits={onEdits} />,
    )
    expect(ui.getByTestId('actual-layer-stack')).toBeTruthy()
    expect(ui.getByTestId('layer-design-settings').hasAttribute('open')).toBe(false)
    fireEvent.click(ui.getByRole('button', { name: 'Toggle Main video visibility' }))
    expect(onEdits.mock.calls.at(-1)?.[0].timelineLanes?.video?.hidden).toBe(true)
    fireEvent.click(ui.getByRole('button', { name: 'Lock Main video track' }))
    expect(onEdits.mock.calls.at(-1)?.[0].timelineLanes?.video?.locked).toBe(true)
  })

  it('E5 reorders overlapping text layers through the shared export stack model', () => {
    const edits = defaultEdits({ clipStartMs: 0, clipEndMs: 30_000 })
    edits.textItems = [newTextItem('a', 1000, 30_000), newTextItem('b', 1000, 30_000)]
    const onEdits = vi.fn()
    const ui = render(<LayersPanel clipId="clip1" edits={edits} layers={[]}
      setLayers={vi.fn()} onEdits={onEdits} />)
    const b = ui.getByTestId('actual-layer-text:b')
    const a = ui.getByTestId('actual-layer-text:a')
    fireEvent.dragStart(b, { dataTransfer: { effectAllowed: 'move' } })
    fireEvent.dragOver(a)
    fireEvent.drop(a)
    expect(onEdits).toHaveBeenCalled()
    expect(onEdits.mock.calls.at(-1)?.[0].layerProps).toBeTruthy()
  })

  it('lists and selects real Text and B-roll items, and hides an item in the shared edits model', () => {
    const edits = defaultEdits({ clipStartMs: 0, clipEndMs: 30_000 })
    edits.textItems = [{ id: 'title1', text: 'Real title', startMs: 1000, endMs: 4000,
      x: 50, y: 50, style: { font: 'Poppins', size: 72, align: 'center', case: 'none', color: '#FFFFFF' } }]
    edits.broll = [{ id: 'overlay1', source: 'stock', assetId: 'asset1', startMs: 2000, endMs: 5000 }]
    const onEdits = vi.fn()
    const onSelectActualLayer = vi.fn()
    const ui = render(
      <LayersPanel clipId="clip1" edits={edits} layers={[]} setLayers={vi.fn()}
        onEdits={onEdits} onSelectActualLayer={onSelectActualLayer} />,
    )
    const stack = ui.getByTestId('actual-layer-stack')
    expect(within(stack).getByText('Real title')).toBeTruthy()
    expect(within(stack).getByText(/B-roll · overlay1/)).toBeTruthy()
    expect(within(stack).getByText('Main video')).toBeTruthy()
    fireEvent.click(ui.getByTestId('actual-layer-select-text:title1'))
    expect(onSelectActualLayer).toHaveBeenCalledWith('text', 'title1', 1000)
    fireEvent.click(ui.getByRole('button', { name: 'Toggle Real title visibility' }))
    expect(onEdits).toHaveBeenCalledWith(expect.objectContaining({ disabledItems: ['text:title1'] }))
  })
  it('E5: dragging B-roll in front of Text updates persistent mixed-track export order', () => {
    const edits = defaultEdits({ clipStartMs: 0, clipEndMs: 30_000 })
    edits.textItems = [newTextItem('title', 1000, 30_000)]
    edits.broll = [{ id: 'overlay', source: 'stock', assetId: 'asset1', startMs: 1000, endMs: 5000 }]
    const onEdits = vi.fn()
    const onSelect = vi.fn()
    const ui = render(<LayersPanel clipId="clip1" edits={edits} layers={[]}
      setLayers={vi.fn()} onEdits={onEdits} onSelectActualLayer={onSelect} />)
    const from = ui.getByTestId('actual-layer-broll:overlay')
    const to = ui.getByTestId('actual-layer-text:title')
    fireEvent.dragStart(from, { dataTransfer: { effectAllowed: 'move' } })
    fireEvent.dragOver(to)
    fireEvent.drop(to)
    expect(onEdits).toHaveBeenCalledTimes(1)
    const next = onEdits.mock.calls[0]![0]!
    expect(visualStack(next).map(t => t.id)).toEqual(['tx1', 'ov1'])
    fireEvent.click(ui.getByTestId('actual-layer-select-text:title'))
    expect(onSelect).toHaveBeenCalledWith('text', 'title', 1000)
  })

  it('E5 isolates a dragged layer when another layer shares the source track', () => {
    const edits = defaultEdits({ clipStartMs: 0, clipEndMs: 30_000 })
    edits.textItems = [newTextItem('title', 1000, 30_000)]
    edits.broll = [
      { id: 'first', source: 'stock', assetId: 'a1', startMs: 1000, endMs: 5000 },
      { id: 'second', source: 'stock', assetId: 'a2', startMs: 1000, endMs: 5000 },
    ]
    const onEdits = vi.fn()
    const ui = render(<LayersPanel clipId="clip1" edits={edits} layers={[]}
      setLayers={vi.fn()} onEdits={onEdits} />)
    const from = ui.getByTestId('actual-layer-broll:first')
    const to = ui.getByTestId('actual-layer-text:title')
    fireEvent.dragStart(from, { dataTransfer: { effectAllowed: 'move' } })
    fireEvent.dragOver(to)
    fireEvent.drop(to)
    const next = onEdits.mock.calls[0]![0]!
    const stack = visualStack(next)
    const isolated = stack.find(t => t.items?.includes('first'))
    expect(isolated?.kind).toBe('overlay')
    expect(isolated?.id).not.toBe('ov1')
    expect(stack.findIndex(t => t.id === isolated?.id)).toBeGreaterThan(stack.findIndex(t => t.id === 'tx1'))
    expect(stack.find(t => t.id === 'ov1')?.items?.includes('second') ?? false).toBe(false)
  })

})
