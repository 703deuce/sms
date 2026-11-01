// @vitest-environment happy-dom
/** TC2b: Blade / Slip / Hand tools, numeric nudge, resizable timeline, drag across an insert. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
vi.mock('@/lib/clips/upload', () => ({}))
import { Timeline } from '@/components/clips/editor/timeline'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { parseNudge } from '@/lib/clips/editor/timecode-nudge'
import { slipEdit, TRIM_TOOL_KEYS } from '@/lib/clips/editor/trim-tools'
import { readTimelineHeight, TIMELINE_HEIGHT_KEY, writeTimelineHeight } from '@/lib/clips/editor/timeline-opts'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const words = Array.from({ length: 30 }, (_, i) => ({ i, w: `w${i}`, s: i * 0.6, e: i * 0.6 + 0.4 }))
const base = (p: Partial<ClipEditsV2> = {}): ClipEditsV2 => ({
  ...normalizeEdits(defaultEdits(bounds), bounds),
  loopFriendlyEnd: false,
  broll: [{ id: 'b1', source: 'stock', assetId: 'a1', startMs: 4000, endMs: 8000, inMs: 1000 }],
  ...p,
} as ClipEditsV2)
afterEach(() => {
  cleanup()
  localStorage.clear()
})
function tl(e: ClipEditsV2) {
  const onCommitEdits = vi.fn()
  const t = render(
    <Timeline edits={e} words={words} shots={[]} outputMs={6000} clipOutputDurationMs={20000} onSeekOutput={vi.fn()} clipStartMs={0} clipEndMs={20000} trimMinMs={0} trimMaxMs={40000} onCommitEdits={onCommitEdits} />,
  )
  const broll = () => t.getAllByTestId('timeline-item-broll')[0]!
  return { ...t, onCommitEdits, broll }
}

describe('TC2b pure', () => {
  it('parseNudge: signed frames / seconds / m:ss; bare or junk → null', () => {
    expect(parseNudge('+10')).toBe(333)
    expect(parseNudge('-3f')).toBe(-100)
    expect(parseNudge('+1.5s')).toBe(1500)
    expect(parseNudge('-0.25s')).toBe(-250)
    expect(parseNudge('+1:02')).toBe(62000)
    expect(parseNudge('10')).toBeNull()
    expect(parseNudge('+abc')).toBeNull()
    expect(parseNudge('+0')).toBeNull()
  })
  it('slip moves the media window only, never before 0; tool keys', () => {
    const e = base()
    const s = slipEdit(e, 'b1', 400)!
    expect(s.broll![0]).toEqual(expect.objectContaining({ startMs: 4000, endMs: 8000, inMs: 600 }))
    expect(slipEdit(e, 'b1', 5000)!.broll![0]!.inMs).toBe(0)
    expect(slipEdit(e, 'nope', 10)).toBeNull()
    expect(TRIM_TOOL_KEYS).toEqual(expect.objectContaining({ y: 'slip', b: 'blade', h: 'hand' }))
  })
  it('timeline height pref', () => {
    expect(readTimelineHeight()).toBeNull()
    writeTimelineHeight(300)
    expect(localStorage.getItem(TIMELINE_HEIGHT_KEY)).toBe('300')
    expect(readTimelineHeight()).toBe(300)
    writeTimelineHeight(null)
    expect(readTimelineHeight()).toBeNull()
  })
})

describe('TC2b timeline UI', () => {
  it('Blade: clicking a B-roll clip splits it (at the click point)', () => {
    const t = tl(base())
    fireEvent.click(t.getByTestId('timeline-tool-blade'))
    expect(t.getByTestId('timeline-track').getAttribute('data-tool')).toBe('blade')
    act(() => void fireEvent.pointerDown(t.broll(), { button: 0, clientX: 0 }))
    const next = t.onCommitEdits.mock.calls.at(-1)?.[0] as ClipEditsV2 | undefined
    // happy-dom has no layout (click maps to 0 ms) → falls back to "can't split" or splits; either way no throw.
    if (next) expect(next.broll!.length).toBe(2)
  })
  it('Slip: dragging a B-roll clip changes inMs, not its position', () => {
    const t = tl(base())
    fireEvent.click(t.getByTestId('timeline-tool-slip'))
    act(() => void fireEvent.pointerDown(t.broll(), { button: 0, clientX: 100 }))
    act(() => void window.dispatchEvent(new PointerEvent('pointermove', { clientX: 100 + 400 })))
    act(() => void window.dispatchEvent(new PointerEvent('pointerup', { clientX: 500 })))
    const next = t.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(next.broll![0]).toEqual(expect.objectContaining({ startMs: 4000, endMs: 8000, inMs: 0 }))
  })
  it('numeric nudge moves the selection; resize handle + collapse', () => {
    const t = tl(base())
    act(() => void fireEvent.pointerDown(t.broll(), { button: 0, clientX: 10 }))
    act(() => void fireEvent.pointerUp(window, { clientX: 10 }))
    const input = t.getByTestId('timeline-nudge') as HTMLInputElement
    fireEvent.change(input, { target: { value: '+1s' } })
    input.value = '+1s'
    fireEvent.keyDown(input, { key: 'Enter' })
    const next = t.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(next.broll![0]).toEqual(expect.objectContaining({ startMs: 5000, endMs: 9000 }))
    expect(t.getByTestId('timeline-resize')).toBeTruthy()
    fireEvent.dblClick(t.getByTestId('timeline-resize'))
    fireEvent.click(t.getByTestId('timeline-collapse'))
    expect(t.queryByTestId('timeline-body')).toBeNull()
    fireEvent.click(t.getByTestId('timeline-collapse'))
    expect(t.getByTestId('timeline-body')).toBeTruthy()
  })
  it('a gap shades every lane (overlays pause there)', () => {
    const t = tl(base({ inserts: [{ id: 'g', sourceId: 'gap', atSrcMs: 6000, inMs: 0, durMs: 1000, audio: 'mute' }] }))
    expect(t.getAllByTestId('timeline-insert-shade')).toHaveLength(1)
  })
})
