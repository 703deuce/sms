// @vitest-environment happy-dom
/** TC2a: export-time lanes (gaps drawn on the lane), HSL / color slider Undo. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/components/clips/editor/e4/slider-row', () => ({
  SliderRow: ({ testId, onLive, onCommit }: { testId: string; onLive?: (v: number) => void; onCommit: (v: number) => void }) => (
    <div>
      <button data-testid={`${testId}-live30`} onClick={() => onLive?.(30)} />
      <button data-testid={`${testId}-live40`} onClick={() => onLive?.(40)} />
      <button data-testid={`${testId}-commit30`} onClick={() => onCommit(30)} />
    </div>
  ),
}))
vi.mock('@/lib/clips/upload', () => ({}))

import { Timeline } from '@/components/clips/editor/timeline'
import { ColorPanel } from '@/components/clips/editor/color-panel'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { exportTimeMap, toBaseMs, toExportMs } from '@/lib/clips/editor/export-time'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const words = Array.from({ length: 30 }, (_, i) => ({ i, w: `w${i}`, s: i * 0.6, e: i * 0.6 + 0.4 }))
const base = (p: Partial<ClipEditsV2> = {}): ClipEditsV2 => ({ ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false, ...p })
const gap = (atSrcMs: number, durMs = 2000) => ({ id: `gap_${atSrcMs}`, sourceId: 'gap', atSrcMs, inMs: 0, durMs, audio: 'mute' as const })
afterEach(() => cleanup())

describe('TC2 export-time map', () => {
  it('identity without inserts; inserts push later points right; inverse maps a gap to its point', () => {
    const segs: [number, number][] = [[0, 20000]]
    expect(exportTimeMap(segs, undefined).wins).toHaveLength(0)
    const m = exportTimeMap(segs, [gap(5000), gap(12000, 1000)])
    expect(m.totalMs).toBe(3000)
    expect(toExportMs(m, 4000)).toBe(4000)
    expect(toExportMs(m, 5000, 'end')).toBe(5000)
    expect(toExportMs(m, 5000, 'start')).toBe(7000)
    expect(toExportMs(m, 13000)).toBe(16000)
    expect(toBaseMs(m, 6000)).toBe(5000)
    expect(toBaseMs(m, 7000)).toBe(5000)
    expect(toBaseMs(m, 8000)).toBe(6000)
    expect(toBaseMs(m, 16000)).toBe(13000)
    for (const t of [0, 3000, 5000, 9000, 12000, 19000]) expect(toBaseMs(m, toExportMs(m, t))).toBe(t)
  })
})

function tl(e: ClipEditsV2, outputMs = 1000) {
  const onCommitEdits = vi.fn()
  const onSeekOutput = vi.fn()
  const t = render(
    <Timeline edits={e} words={words} shots={[]} outputMs={outputMs} clipOutputDurationMs={20000} onSeekOutput={onSeekOutput} clipStartMs={0} clipEndMs={20000} trimMinMs={0} trimMaxMs={40000} onCommitEdits={onCommitEdits} />,
  )
  return { ...t, onCommitEdits, onSeekOutput }
}
const px = (el: Element, k: 'left' | 'width') => parseFloat((el as HTMLElement).style[k])

describe('TC2 gaps drawn on the lane', () => {
  it('a gap is a black block as long as it is; the next clip starts after it', () => {
    const t = tl(base({ videoSplits: [5000], inserts: [gap(5000)] }))
    const blk = t.getByTestId('timeline-insert-marker')
    expect(blk.getAttribute('data-gap')).toBe('true')
    const [a, b] = t.getAllByTestId('timeline-item-video')
    const pxPerMs = px(blk, 'width') / 2000
    expect(px(blk, 'left')).toBeCloseTo(5000 * pxPerMs, 3)
    expect(px(a!, 'left') + px(a!, 'width')).toBeCloseTo(5000 * pxPerMs, 3)
    expect(px(b!, 'left')).toBeCloseTo(7000 * pxPerMs, 3)
    expect(t.getByTestId('timeline-insert-label').textContent).toBe('Gap +2.0s')
  })
  it('Insert gap inside a clip splits it there and adds the gap', () => {
    const t = tl(base(), 10000)
    fireEvent.click(t.getByTestId('timeline-gap'))
    const next = t.onCommitEdits.mock.calls.at(-1)![0] as ClipEditsV2
    expect(next.videoSplits).toEqual([10000])
    expect(next.inserts).toEqual([expect.objectContaining({ sourceId: 'gap', durMs: 1000, atSrcMs: 10000 })])
  })
  it('no inserts: lanes unchanged (identity)', () => {
    const t = tl(base({ videoSplits: [5000] }))
    const [a, b] = t.getAllByTestId('timeline-item-video')
    expect(px(b!, 'left')).toBeCloseTo(px(a!, 'left') + px(a!, 'width'), 3)
    expect(t.queryByTestId('timeline-insert-marker')).toBeNull()
  })
})

describe('TC2 color slider Undo', () => {
  it('a trailing slider value after release is not a new audition (it would mask Undo)', () => {
    const onLive = vi.fn()
    const onEdits = vi.fn()
    const t = render(<ColorPanel edits={base()} target={{ kind: 'video' }} onEdits={onEdits} onLive={onLive} />)
    fireEvent.click(t.getByTestId('color-section-toggle-hsl'))
    fireEvent.click(t.getByTestId('color-hsl-s-live30'))
    expect(onLive.mock.calls.at(-1)![0]).not.toBeNull()
    fireEvent.click(t.getByTestId('color-hsl-s-commit30'))
    expect(onEdits).toHaveBeenCalledTimes(1)
    fireEvent.click(t.getByTestId('color-hsl-s-live30'))
    expect(onLive.mock.calls.at(-1)![0]).toBeNull()
    fireEvent.click(t.getByTestId('color-hsl-s-live40'))
    expect(onLive.mock.calls.at(-1)![0]).not.toBeNull()
  })
  it('editor Undo / Redo drop the live audition before restoring edits', () => {
    const src = readFileSync(join(process.cwd(), 'components/clips/editor/editor-shell.tsx'), 'utf8')
    expect(src).toMatch(/const undo = useCallback\(\(\) => \{\s*setAuditionEdits\(null\)\s*undoEdits\(\)/)
    expect(src).toMatch(/const redo = useCallback\(\(\) => \{\s*setAuditionEdits\(null\)\s*redoEdits\(\)/)
  })
})
