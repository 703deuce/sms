// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { Timeline } from '@/components/clips/editor/timeline'
import { filterPaletteCommands } from '@/components/clips/editor/timeline/command-palette'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { shortcutGroups, timelineCommandFor } from '@/lib/clips/editor/timeline-shortcuts'
import { getPreviewRate, setPreviewRate } from '@/lib/clips/editor/preview-rate'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const words = Array.from({ length: 30 }, (_, i) => ({ i, w: `w${i}`, s: i * 0.6, e: i * 0.6 + 0.4 }))

function edits(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return {
    ...normalizeEdits(defaultEdits(bounds), bounds),
    loopFriendlyEnd: false,
    broll: [
      { id: 'b1', source: 'stock', assetId: 'a1', startMs: 5000, endMs: 8000 },
      { id: 'b2', source: 'stock', assetId: 'a2', startMs: 12000, endMs: 14000 },
    ],
    ...patch,
  }
}

function setup(e: ClipEditsV2 = edits(), extra: Record<string, unknown> = {}) {
  const onCommitEdits = vi.fn()
  const onSeekOutput = vi.fn()
  const utils = render(
    <Timeline
      edits={e}
      words={words}
      shots={[]}
      outputMs={10000}
      clipOutputDurationMs={20000}
      onSeekOutput={onSeekOutput}
      clipStartMs={bounds.clipStartMs}
      clipEndMs={bounds.clipEndMs}
      trimMinMs={bounds.trimMinMs}
      trimMaxMs={bounds.trimMaxMs}
      onCommitEdits={onCommitEdits}
      {...extra}
    />,
  )
  const broll = (id: string) => utils.getAllByTestId('timeline-item-broll').find((el) => el.getAttribute('data-item-id') === id)!
  const key = (init: KeyboardEventInit) => act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })))
  return { ...utils, onCommitEdits, onSeekOutput, broll, key }
}

afterEach(() => cleanup())

describe('TC1 shortcuts', () => {
  it('maps the new keys', () => {
    expect(timelineCommandFor({ key: 'm' })).toBe('marker')
    expect(timelineCommandFor({ key: 'M', shiftKey: true })).toBe('nextMarker')
    expect(timelineCommandFor({ key: 'µ', code: 'KeyM', altKey: true })).toBe('prevMarker')
    expect(timelineCommandFor({ key: '¬', code: 'KeyL', altKey: true })).toBe('loop')
    expect(timelineCommandFor({ key: 'E', shiftKey: true })).toBe('toggleEnabled')
    expect(timelineCommandFor({ key: 'e' })).toBeNull()
    expect(timelineCommandFor({ key: 'g', ctrlKey: true })).toBe('group')
    expect(timelineCommandFor({ key: 'G', metaKey: true, shiftKey: true })).toBe('ungroup')
    expect(timelineCommandFor({ key: 'r', ctrlKey: true })).toBe('speed')
    expect(timelineCommandFor({ key: 'e', metaKey: true })).toBe('export')
    expect(timelineCommandFor({ key: 'k', ctrlKey: true })).toBe('palette')
    expect(timelineCommandFor({ key: '[' })).toBe('trimStart')
    expect(timelineCommandFor({ key: ']' })).toBe('trimEnd')
    // unchanged
    expect(timelineCommandFor({ key: 'x', altKey: true })).toBe('clearInOut')
    expect(timelineCommandFor({ key: 'f' })).toBe('matchFrame')
    const rows = shortcutGroups(false).flatMap((g) => g.rows.map((r) => r.label))
    expect(rows.some((l) => /marker/i.test(l))).toBe(true)
    expect(rows.some((l) => /Command palette/.test(l))).toBe(true)
  })

  it('palette filter: every word must match', () => {
    const cmds = [
      { label: 'Add / remove marker at playhead', group: 'Markers', keys: 'M' },
      { label: 'Insert gap at playhead', group: 'Edit' },
      { label: 'Zoom in', group: 'Timeline', keys: '+' },
    ]
    expect(filterPaletteCommands(cmds, 'play').map((c) => c.label)).toHaveLength(2)
    expect(filterPaletteCommands(cmds, 'gap play')).toEqual([cmds[1]])
    expect(filterPaletteCommands(cmds, '')).toHaveLength(3)
    expect(filterPaletteCommands(cmds, 'nothing')).toEqual([])
  })
})

describe('TC1 timeline UI', () => {
  it('M adds a marker at the playhead; markers render on the ruler and seek on click', () => {
    const t = setup()
    t.key({ key: 'm' })
    const next = t.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(next.markers).toEqual([expect.objectContaining({ ms: 10000, color: 'blue' })])
    cleanup()
    const t2 = setup(edits({ markers: [{ id: 'm1', ms: 4000, color: 'red', label: 'Hook', chapter: true }] }))
    const flag = t2.getByTestId('timeline-marker')
    expect(flag.getAttribute('data-ms')).toBe('4000')
    fireEvent.click(flag)
    expect(t2.onSeekOutput).toHaveBeenCalledWith(4000)
    fireEvent.doubleClick(flag)
    expect(t2.getByTestId('marker-list')).toBeTruthy()
    expect((t2.getByTestId('marker-label') as HTMLInputElement).value).toBe('Hook')
    t2.key({ key: 'm', code: 'KeyM', altKey: true })
    expect(t2.onSeekOutput).toHaveBeenLastCalledWith(4000)
  })

  it('Shift+E deactivates the selection; deactivated items render dimmed + flagged', () => {
    const t = setup()
    act(() => void fireEvent.pointerDown(t.broll('b1'), { button: 0, clientX: 10 }))
    act(() => void fireEvent.pointerUp(window, { clientX: 10 }))
    t.key({ key: 'E', shiftKey: true })
    const next = t.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(next.disabledItems).toEqual(['broll:b1'])
    cleanup()
    const t2 = setup(edits({ disabledItems: ['broll:b1'] }))
    expect(t2.broll('b1').getAttribute('data-disabled')).toBe('true')
    expect(t2.broll('b2').getAttribute('data-disabled')).toBeNull()
  })

  it('grouped items: clicking one selects the group; Ctrl+Shift+G ungroups', () => {
    const t = setup(edits({ groups: [{ id: 'g1', items: ['broll:b1', 'broll:b2'] }] }))
    expect(t.broll('b1').getAttribute('data-grouped')).toBe('true')
    act(() => void fireEvent.pointerDown(t.broll('b1'), { button: 0, clientX: 10 }))
    act(() => void fireEvent.pointerUp(window, { clientX: 10 }))
    expect(t.broll('b2').getAttribute('data-selected')).toBe('true')
    t.key({ key: 'G', ctrlKey: true, shiftKey: true })
    const next = t.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(next.groups).toBeUndefined()
  })

  it('Gap button inserts a 1 s gap at the playhead; magnet / link toggles store only `false`', () => {
    const t = setup()
    fireEvent.click(t.getByTestId('timeline-gap'))
    const a = t.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(a.inserts).toEqual([expect.objectContaining({ sourceId: 'gap', durMs: 1000, atSrcMs: 10000 })])
    fireEvent.click(t.getByTestId('timeline-magnet'))
    expect((t.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2).timelineOpts).toEqual({ magnet: false })
    fireEvent.click(t.getByTestId('timeline-link-overlays'))
    expect((t.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2).timelineOpts).toEqual({ rippleOverlays: false })
  })

  it('Ctrl+K opens the palette; Enter runs the highlighted command; Ctrl+E calls onOpenExport', () => {
    const onOpenExport = vi.fn()
    const t = setup(edits(), { onOpenExport })
    t.key({ key: 'k', ctrlKey: true })
    const input = t.getByTestId('command-palette-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'insert gap' } })
    expect(t.getAllByTestId('command-palette-item')).toHaveLength(1)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect((t.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2).inserts?.[0]?.sourceId).toBe('gap')
    expect(t.queryByTestId('command-palette')).toBeNull()
    t.key({ key: 'e', ctrlKey: true })
    expect(onOpenExport).toHaveBeenCalledTimes(1)
  })

  it('preview speed buttons drive the shared store', () => {
    const t = setup()
    fireEvent.click(t.getByTestId('timeline-preview-rate-0.5'))
    expect(getPreviewRate()).toBe(0.5)
    expect(t.getByTestId('timeline-preview-rate-0.5').getAttribute('aria-checked')).toBe('true')
    act(() => setPreviewRate(1))
    expect(t.getByTestId('timeline-preview-rate').getAttribute('data-value')).toBe('1')
  })

  it('loop needs in / out; with a range, playback past Out jumps back to In', () => {
    const onSeekOutput = vi.fn()
    const props = {
      edits: edits(),
      words,
      shots: [],
      clipOutputDurationMs: 20000,
      onSeekOutput,
      clipStartMs: 0,
      clipEndMs: 20000,
      onCommitEdits: vi.fn(),
    }
    const r = render(<Timeline {...props} outputMs={2000} />)
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' })))
    r.rerender(<Timeline {...props} outputMs={5000} />)
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'o' })))
    r.rerender(<Timeline {...props} outputMs={2500} />)
    fireEvent.click(r.getByTestId('timeline-loop'))
    expect(r.getByTestId('timeline-loop').getAttribute('aria-pressed')).toBe('true')
    r.rerender(<Timeline {...props} outputMs={4900} />)
    onSeekOutput.mockClear()
    r.rerender(<Timeline {...props} outputMs={5030} />)
    expect(onSeekOutput).toHaveBeenCalledWith(2000)
  })

  it('[ trims the selected item start to the playhead', () => {
    const t = setup(edits({ broll: [{ id: 'b1', source: 'stock', assetId: 'a1', startMs: 8000, endMs: 12000 }] }))
    act(() => void fireEvent.pointerDown(t.broll('b1'), { button: 0, clientX: 10 }))
    act(() => void fireEvent.pointerUp(window, { clientX: 10 }))
    t.key({ key: '[' })
    const next = t.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(next.broll![0]).toMatchObject({ startMs: 10000, endMs: 12000 })
  })
})
