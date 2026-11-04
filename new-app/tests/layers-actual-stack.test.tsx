// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { LayersPanel } from '@/components/clips/editor/layers-panel'
import { defaultEdits } from '@/lib/clips/edits'

afterEach(cleanup)

describe('actual Layers stack (E5)', () => {
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
})
