// @vitest-environment happy-dom
/** TC1fix: magnet preference, magnet-off delete → gap, display duration with gaps, group badge, chapters. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { Timeline } from '@/components/clips/editor/timeline'
import { defaultEdits, displayDurationMs, displayPositionMs, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { deleteItems, buildTimelineItems } from '@/lib/clips/editor/clip-timeline'
import { MAGNET_PREF_KEY, readMagnetPref, writeMagnetPref } from '@/lib/clips/editor/timeline-opts'
import { chapterText, type Marker } from '@/lib/clips/editor/markers'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const words = Array.from({ length: 30 }, (_, i) => ({ i, w: `w${i}`, s: i * 0.6, e: i * 0.6 + 0.4 }))
const base = (p: Partial<ClipEditsV2> = {}): ClipEditsV2 => ({ ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false, ...p })

beforeEach(() => localStorage.removeItem(MAGNET_PREF_KEY))
afterEach(() => cleanup())

describe('TC1fix magnet', () => {
  it('per-user preference, default ON', () => {
    expect(readMagnetPref()).toBe(true)
    writeMagnetPref(false)
    expect(readMagnetPref()).toBe(false)
    writeMagnetPref(true)
    expect(readMagnetPref()).toBe(true)
  })
  it('magnet off: deleting the middle piece leaves a gap of its length; total display time unchanged', () => {
    const e = base({ videoSplits: [5000, 10000] })
    const lanes = buildTimelineItems({ edits: e, previewEdits: e })
    const mid = lanes.video[1]!
    const before = displayDurationMs(e)
    const off = deleteItems({ edits: e, previewEdits: e, magnet: false }, [{ lane: 'video', id: mid.id }])!
    expect(off.inserts).toEqual([expect.objectContaining({ sourceId: 'gap', durMs: 5000, atSrcMs: 10000 })])
    expect(displayDurationMs(off)).toBe(before)
    // a point in Clip 3 keeps its export time
    expect(displayPositionMs(off, 5000 + 1000)).toBe(displayPositionMs(e, 10000 + 1000))
    // magnet on (pref) wins over a legacy saved `magnet: false`
    const on = deleteItems({ edits: { ...e, timelineOpts: { magnet: false } }, previewEdits: e, magnet: true }, [{ lane: 'video', id: mid.id }])!
    expect(on.inserts ?? []).toHaveLength(0)
    expect(displayDurationMs(on)).toBe(before - 5000)
  })
  it('an inserted 1 s gap grows the display duration by 1 s', () => {
    const e = base()
    const g = { ...e, inserts: [{ id: 'gap_1', sourceId: 'gap', atSrcMs: 3000, inMs: 0, durMs: 1000, audio: 'mute' as const }] }
    expect(displayDurationMs(g)).toBe(displayDurationMs(e) + 1000)
    expect(displayPositionMs(g, 2000)).toBe(2000)
    expect(displayPositionMs(g, 4000)).toBe(5000)
  })
  it('the Delete key with the magnet off (pref) commits a gap', () => {
    writeMagnetPref(false)
    const e = base({ videoSplits: [5000, 10000] })
    const onCommitEdits = vi.fn()
    const t = render(
      <Timeline edits={e} words={words} shots={[]} outputMs={7000} clipOutputDurationMs={20000} onSeekOutput={vi.fn()} clipStartMs={0} clipEndMs={20000} trimMinMs={0} trimMaxMs={40000} onCommitEdits={onCommitEdits} />,
    )
    expect(t.getByTestId('timeline-magnet').getAttribute('aria-pressed')).toBe('false')
    const mid = t.getAllByTestId('timeline-item-video')[1]!
    act(() => void fireEvent.pointerDown(mid, { button: 0, clientX: 10 }))
    act(() => void fireEvent.pointerUp(window, { clientX: 10 }))
    expect(mid.getAttribute('data-selected')).toBe('true')
    fireEvent.keyDown(t.getByTestId('timeline-scroll'), { key: 'Delete' })
    const next = onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(next.inserts?.[0]).toEqual(expect.objectContaining({ sourceId: 'gap', durMs: 5000 }))
  })
})

describe('TC1fix group badge', () => {
  it('members show G1; selecting one outlines the whole group', () => {
    const e = base({
      broll: [
        { id: 'b1', source: 'stock', assetId: 'a1', startMs: 5000, endMs: 8000 },
        { id: 'b2', source: 'stock', assetId: 'a2', startMs: 12000, endMs: 14000 },
      ],
      groups: [{ id: 'g1', items: ['broll:b1', 'broll:b2'] }],
    } as Partial<ClipEditsV2>)
    const t = render(
      <Timeline edits={e} words={words} shots={[]} outputMs={1000} clipOutputDurationMs={20000} onSeekOutput={vi.fn()} clipStartMs={0} clipEndMs={20000} trimMinMs={0} trimMaxMs={40000} onCommitEdits={vi.fn()} />,
    )
    expect(t.getAllByTestId('timeline-group-badge').map((b) => b.textContent)).toEqual(['G1', 'G1'])
    const b = (id: string) => t.getAllByTestId('timeline-item-broll').find((x) => x.getAttribute('data-item-id') === id)!
    act(() => void fireEvent.pointerDown(b('b1'), { button: 0, clientX: 10 }))
    act(() => void fireEvent.pointerUp(window, { clientX: 10 }))
    expect(b('b2').getAttribute('data-group-selected')).toBe('true')
  })
})

describe('TC1fix chapters (YouTube)', () => {
  const mk = (ms: number, label?: string): Marker => ({ id: `m${ms}`, ms, color: 'blue', chapter: true, ...(label ? { label } : {}) })
  it('first line is 0:00; "Intro" is added when the first chapter starts later; M:SS / MM:SS lines', () => {
    const txt = chapterText([mk(30_000, 'Setup'), mk(125_000, 'Gameplay'), mk(725_000, 'Outro')], 900_000)
    expect(txt.split('\n')).toEqual(['0:00 Intro', '0:30 Setup', '2:05 Gameplay', '12:05 Outro'])
    for (const l of txt.split('\n')) expect(l).toMatch(/^\d{1,2}:\d{2} \S/)
  })
  it('a first chapter within 10 s moves to 0:00 (no extra Intro); unlabeled → Chapter N; hours past 1 h', () => {
    expect(chapterText([mk(4000, 'Hello'), mk(60_000)], 120_000).split('\n')).toEqual(['0:00 Hello', '1:00 Chapter 2'])
    expect(chapterText([mk(0, 'A'), mk(3_700_000, 'B')], 4_000_000).split('\n')).toEqual(['0:00:00 A', '1:01:40 B'])
    expect(chapterText([], 1000)).toBe('')
  })
})
