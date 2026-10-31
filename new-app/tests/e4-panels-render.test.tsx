// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { newTextItem } from '@/lib/clips/editor/text-items'
import { TextPanel } from '@/components/clips/editor/text-panel'
import { ColorPanel } from '@/components/clips/editor/color-panel'
import { TemplatesPanel } from '@/components/clips/editor/templates-panel'
import { ItemSpeedControl } from '@/components/clips/editor/timeline/item-speed-control'
import { Timeline } from '@/components/clips/editor/timeline'

vi.mock('@/components/clips/producer/producer-panel', () => ({
  ProducerPanel: (p: {
    edits: ClipEditsV2
    costLabel?: (t: { name: string; args: Record<string, unknown> }) => string
    onProposal?: (e: ClipEditsV2, n: number, before: ClipEditsV2, s: string[]) => void
  }) => (
    <div>
      <span data-testid="stub-cost">{p.costLabel?.({ name: 'generate_music', args: {} })}</span>
      <button
        type="button"
        data-testid="stub-propose"
        onClick={() => p.onProposal?.({ ...p.edits, speed: 1.5 } as ClipEditsV2, 2, p.edits, ['Speed 1.5×'])}
      />
    </div>
  ),
}))
// Imported after the mock.
import { ProducerPopover } from '@/components/clips/editor/producer-popover'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
function base(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return { ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false, ...patch }
}
const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1]![0] as ClipEditsV2
const click = (el: Element) => act(() => void fireEvent.click(el))

afterEach(() => cleanup())

describe('Text panel', () => {
  it('Add text inserts an item at the playhead and selects it', () => {
    const onEdits = vi.fn()
    const onSelect = vi.fn()
    const t = render(<TextPanel edits={base()} onEdits={onEdits} playheadMs={4200} durationMs={20000} selectedId={null} onSelect={onSelect} />)
    click(t.getByTestId('text-add'))
    const items = last(onEdits).textItems!
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ startMs: 4200, endMs: 7200 })
    expect(onSelect).toHaveBeenCalledWith(items[0]!.id)
  })

  it('inspector edits the selected item (preset, align, stroke, delete)', () => {
    const it0 = newTextItem('t1', 0, 20000, 'basic', 'Hi')
    const e = base({ textItems: [it0] })
    const onEdits = vi.fn()
    const t = render(<TextPanel edits={e} onEdits={onEdits} playheadMs={0} durationMs={20000} selectedId="t1" onSelect={vi.fn()} />)
    expect(t.getByTestId('text-inspector')).toBeTruthy()
    click(t.getByTestId('text-preset-comic'))
    expect(last(onEdits).textItems![0]!.presetId).toBe('comic')
    click(t.getByTestId('text-align-left'))
    expect(last(onEdits).textItems![0]!.style.align).toBe('left')
    click(t.getByTestId('text-delete'))
    expect(last(onEdits).textItems ?? []).toEqual([])
  })

  it('clearing the text keeps the item (no blank commit)', () => {
    const e = base({ textItems: [newTextItem('t1', 0, 20000, 'basic', 'Hi')] })
    const onEdits = vi.fn()
    const t = render(<TextPanel edits={e} onEdits={onEdits} playheadMs={0} durationMs={20000} selectedId="t1" onSelect={vi.fn()} />)
    act(() => void fireEvent.change(t.getByTestId('text-content'), { target: { value: '' } }))
    expect(onEdits).not.toHaveBeenCalled()
    act(() => void fireEvent.change(t.getByTestId('text-content'), { target: { value: 'New' } }))
    expect(last(onEdits).textItems![0]!.text).toBe('New')
  })
})

describe('Color panel', () => {
  it('whole video: filter + reset', () => {
    const onEdits = vi.fn()
    const t = render(<ColorPanel edits={base()} target={{ kind: 'video' }} onEdits={onEdits} />)
    expect(t.getByTestId('color-target').textContent).toBe('Whole video')
    click(t.getByTestId('color-filter-vivid'))
    expect(last(onEdits).color?.video?.preset).toBe('vivid')
    for (const k of ['brightness', 'contrast', 'saturation', 'temperature', 'tint', 'vibrance']) expect(t.getByTestId(`color-adjust-${k}`)).toBeTruthy()
  })

  it('a selected Video item gets its own source-anchored look; Apply to all copies it', () => {
    const e = base({ color: { segments: [{ fromMs: 2000, toMs: 5000, spec: { preset: 'cool' } }] } })
    const onEdits = vi.fn()
    const t = render(<ColorPanel edits={e} target={{ kind: 'segment', fromMs: 2000, toMs: 5000, label: 'A' }} onEdits={onEdits} />)
    expect(t.getByTestId('color-filter-cool').getAttribute('data-active')).toBe('true')
    expect(t.getByTestId('color-intensity')).toBeTruthy()
    click(t.getByTestId('color-filter-film'))
    expect(last(onEdits).color?.segments).toEqual([{ fromMs: 2000, toMs: 5000, spec: { preset: 'film' } }])
    click(t.getByTestId('color-apply-all'))
    expect(last(onEdits).color).toEqual({ video: { preset: 'cool' } })
  })

  it('B-roll target writes color.broll[id]', () => {
    const e = base({ broll: [{ id: 'b1', source: 'stock', assetId: 'a', startMs: 0, endMs: 2000 }] as ClipEditsV2['broll'] })
    const onEdits = vi.fn()
    const t = render(<ColorPanel edits={e} target={{ kind: 'broll', id: 'b1', label: 'B' }} onEdits={onEdits} />)
    expect(t.queryByTestId('color-apply-all')).toBeNull()
    click(t.getByTestId('color-filter-bw'))
    expect(last(onEdits).color?.broll?.b1?.preset).toBe('bw')
  })
})

describe('Templates panel', () => {
  it('existing sections come first, starter looks last; each tap is one edit', () => {
    const onEdits = vi.fn()
    const onApplyBrand = vi.fn()
    const t = render(
      <TemplatesPanel
        edits={base()}
        onEdits={onEdits}
        layoutSlot={<div data-testid="layout-slot" />}
        brandTemplates={[{ id: 'k1', name: 'My kit' }]}
        onApplyBrand={onApplyBrand}
        playheadMs={0}
        durationMs={20000}
      />,
    )
    const order = ['layouts', 'captions', 'text', 'brand', 'starters'].map((s) => t.getByTestId(`templates-${s}`))
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    expect(t.getByTestId('layout-slot')).toBeTruthy()
    // T6 flags off in tests → 10 classic caption styles.
    expect(t.getAllByTestId(/^templates-caption-/)).toHaveLength(10)
    click(t.getByTestId('templates-caption-karaoke'))
    expect(last(onEdits).captions.presetId).toBe('karaoke')
    click(t.getByTestId('templates-brand-k1'))
    expect(onApplyBrand).toHaveBeenCalledWith('k1')
    click(t.getByTestId('templates-starter-retro'))
    const s = last(onEdits)
    expect(s.captions.presetId).toBe('typewriter')
    expect(s.color?.video?.preset).toBe('vintage')
    expect(s.textItems?.[0]?.presetId).toBe('starter:retro')
    click(t.getByTestId('templates-text-hype'))
    expect(last(onEdits).textItems?.[0]?.presetId).toBe('hype')
  })
})

describe('Item speed', () => {
  it('preset buttons write a source-anchored speed', () => {
    const onCommit = vi.fn()
    const t = render(<ItemSpeedControl edits={base()} srcInMs={1000} srcOutMs={4000} onCommit={onCommit} />)
    click(t.getByTestId('item-speed-2'))
    expect(last(onCommit).segmentSpeeds).toEqual([{ fromMs: 1000, toMs: 4000, speed: 2 }])
  })

  it('timeline: selecting a Video item shows Speed; sped items get a badge', () => {
    const e = base({ segmentSpeeds: [{ fromMs: 0, toMs: 20000, speed: 2 }] })
    const onSel = vi.fn()
    const t = render(
      <Timeline
        edits={e}
        words={[]}
        shots={[]}
        outputMs={0}
        clipOutputDurationMs={20000}
        onSeekOutput={vi.fn()}
        clipStartMs={0}
        clipEndMs={20000}
        trimMinMs={0}
        trimMaxMs={40000}
        onCommitEdits={vi.fn()}
        onSelectionChange={onSel}
      />,
    )
    expect(t.getAllByTestId(/^timeline-speed-badge-/)[0]!.textContent).toBe('2×')
    const vid = t.getAllByTestId('timeline-item-video')[0]!
    act(() => void fireEvent.pointerDown(vid, { button: 0, clientX: 100, pointerId: 1 }))
    act(() => void fireEvent.pointerUp(window, { clientX: 100, pointerId: 1 }))
    expect(t.getByTestId('item-speed-value').textContent).toBe('2×')
    expect(onSel.mock.calls.at(-1)![0]).toMatchObject({ lane: 'video', srcInMs: 0, srcOutMs: 20000 })
  })
})

describe('Producer pop-over', () => {
  function setup(open = true) {
    const p = { onClose: vi.fn(), onAudition: vi.fn(), onAccept: vi.fn(), onUndo: vi.fn() }
    const e = base()
    const t = render(<ProducerPopover open={open} clipId="c1" bounds={bounds} edits={e} durationMs={30000} {...p} />)
    return { t, e, ...p }
  }

  it('hidden when closed; Esc closes', () => {
    const closed = setup(false)
    expect(closed.t.getByTestId('producer-popover').hidden).toBe(true)
    cleanup()
    const s = setup()
    act(() => void fireEvent.keyDown(window, { key: 'Escape' }))
    expect(s.onClose).toHaveBeenCalled()
  })

  it('shows paid-tool cost; proposal → Preview auditions, Accept applies once', () => {
    const s = setup()
    expect(s.t.getByTestId('stub-cost').textContent).toMatch(/^2 credits$/)
    click(s.t.getByTestId('stub-propose'))
    expect(s.t.getByTestId('producer-proposal').textContent).toContain('2 proposed changes')
    click(s.t.getByTestId('producer-preview'))
    expect(s.onAudition).toHaveBeenLastCalledWith(expect.objectContaining({ speed: 1.5 }))
    click(s.t.getByTestId('producer-accept'))
    expect(s.onAccept).toHaveBeenCalledTimes(1)
    expect(s.onAccept.mock.calls[0]![2]).toBe(2)
    expect(s.onAccept.mock.calls[0]![1]).toBe(s.e)
    expect(s.onAudition).toHaveBeenLastCalledWith(null)
    expect(s.t.queryByTestId('producer-proposal')).toBeNull()
  })

  it('Discard drops the proposal without applying', () => {
    const s = setup()
    click(s.t.getByTestId('stub-propose'))
    click(s.t.getByTestId('producer-discard'))
    expect(s.onAccept).not.toHaveBeenCalled()
    expect(s.t.queryByTestId('producer-proposal')).toBeNull()
  })
})
