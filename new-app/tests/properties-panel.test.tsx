// @vitest-environment happy-dom
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { addAdjustLayer } from '@/lib/clips/editor/adjust-layers'
import { layerFxOf, setLayerFx } from '@/lib/clips/editor/layer-fx'
import { newTextItem } from '@/lib/clips/editor/text-items'
import { PropertiesPanel } from '@/components/clips/editor/properties-panel'
import { LayerFxControls } from '@/components/clips/editor/g4/layer-fx-controls'

const bounds = { clipStartMs: 0, clipEndMs: 20_000, trimMinMs: 0, trimMaxMs: 40_000 }
const base = (patch: Partial<ClipEditsV2> = {}): ClipEditsV2 => ({ ...normalizeEdits(defaultEdits(bounds), bounds), ...patch })
const click = (el: Element) => act(() => void fireEvent.click(el))
const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1]![0] as ClipEditsV2

afterEach(() => cleanup())

describe('CV-17c properties Video tab (mask + blend)', () => {
  it('text item shows layer fx mask and blend controls', () => {
    function W() {
      const [e, set] = useState(base({ textItems: [newTextItem('t1', 0, 20_000)] }))
      return (
        <>
          <LayerFxControls
            edits={e}
            target="text:t1"
            localMs={500}
            features={{ mask: true, blend: true }}
            onCommit={set}
            readOnly={false}
          />
          <pre data-testid="dump">{JSON.stringify(e.layerFx ?? null)}</pre>
        </>
      )
    }
    const t = render(<W />)
    click(t.getByTestId('layer-fx-mask-ellipse'))
    click(t.getByTestId('layer-fx-blend-screen'))
    const row = JSON.parse(t.getByTestId('dump').textContent!)[0]
    expect(row.target).toBe('text:t1')
    expect(row.mask.shape).toBe('ellipse')
    expect(row.blend).toBe('screen')
  })

  it('adjustment layer Video tab is mask/blend only', () => {
    const added = addAdjustLayer(undefined, 0, 5000, 1)!
    const e = base({ adjustLayers: added.layers })
    const onCommit = vi.fn()
    const t = render(
      <PropertiesPanel
        edits={e}
        target={`adjust:${added.id}`}
        label="Adjust"
        outputMs={1000}
        onCommit={onCommit}
        onSeekOutput={vi.fn()}
        cropMode={false}
        onCropModeChange={vi.fn()}
      />,
    )
    click(t.getByRole('tab', { name: 'Video' }))
    expect(t.getByTestId('layer-fx')).toBeTruthy()
    expect(t.queryByTestId('properties-transform')).toBeNull()
    click(t.getByTestId('layer-fx-mask-rect'))
    expect(layerFxOf(last(onCommit), `adjust:${added.id}`)?.mask?.shape).toBe('rect')
  })

  it('setLayerFx round-trips text and adjust targets', () => {
    let fx = setLayerFx(undefined, 'text:x', { blend: 'difference' })
    fx = setLayerFx(fx, 'adjust:y', { mask: { shape: 'linear', x: 50, y: 50, w: 60, h: 40, rot: 0, feather: 5 } })
    expect(layerFxOf({ layerFx: fx }, 'text:x')?.blend).toBe('difference')
    expect(layerFxOf({ layerFx: fx }, 'adjust:y')?.mask?.shape).toBe('linear')
  })
})
