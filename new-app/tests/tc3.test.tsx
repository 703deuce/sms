// @vitest-environment happy-dom
/** TC3: gap click seeks to its start, slider Ctrl+Z, taller timeline, rotate 90°, full screen. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
vi.mock('@/lib/clips/upload', () => ({}))
import { Timeline } from '@/components/clips/editor/timeline'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { exportTimeMap, seekBaseMs } from '@/lib/clips/editor/export-time'
import { rotateBy90 } from '@/lib/clips/editor/canvas-ops'
import { writeTimelineHeight } from '@/lib/clips/editor/timeline-opts'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const base = (): ClipEditsV2 => ({ ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false })
const src = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('TC3 fixes', () => {
  it('(a) a click on a gap seeks to the gap start (1 ms before its point), elsewhere unchanged', () => {
    const m = exportTimeMap([[0, 20000]], [{ id: 'g', sourceId: 'gap', atSrcMs: 5000, inMs: 0, durMs: 4000, audio: 'mute' }])
    expect(seekBaseMs(m, 6000, 20000)).toBe(4999)
    expect(seekBaseMs(m, 8999, 20000)).toBe(4999)
    expect(seekBaseMs(m, 9000, 20000)).toBe(5000)
    expect(seekBaseMs(m, 3000, 20000)).toBe(3000)
    expect(seekBaseMs(m, 30000, 20000)).toBe(20000)
  })
  it('(c) Ctrl/⌘+Z and Ctrl+Y stay global on a focused slider', () => {
    const s = src('components/clips/editor/editor-shell.tsx')
    expect(s).toMatch(/isSliderTarget\(e\.target\) && \(e\.metaKey \|\| e\.ctrlKey\)[\s\S]{0,200}undo\(\)/)
    const i = s.indexOf('isSliderTarget(e.target) && (e.metaKey')
    expect(i).toBeGreaterThan(0)
    expect(i).toBeLessThan(s.indexOf('if (isEditableTarget(e.target)) return'))
  })
  it('(d) a saved height is the body height (taller than the tracks is allowed)', () => {
    writeTimelineHeight(900)
    const t = render(
      <Timeline edits={base()} words={[]} shots={[]} outputMs={0} clipOutputDurationMs={20000} onSeekOutput={vi.fn()} clipStartMs={0} clipEndMs={20000} trimMinMs={0} trimMaxMs={40000} onCommitEdits={vi.fn()} />,
    )
    const body = t.getByTestId('timeline-body')
    expect(body.style.height).toBe('900px')
    expect(body.style.maxHeight).toBe('')
  })
})

describe('TC3 canvas', () => {
  it('rotate 90°: static value, wraps, animated tracks shift every key, back to 0 drops the track', () => {
    let e = rotateBy90(base(), 'broll:b', 1)
    expect(e.keyframes).toEqual([{ target: 'broll:b', prop: 'rotation', points: [], value: 90 }])
    e = rotateBy90(e, 'broll:b', -1)
    expect(e.keyframes).toBeUndefined()
    const anim = { ...base(), keyframes: [{ target: 'text:t' as const, prop: 'rotation' as const, points: [{ tMs: 0, v: 300 }, { tMs: 1000, v: 0 }] }] } as ClipEditsV2
    expect(rotateBy90(anim, 'text:t', 1).keyframes![0]!.points.map((p) => p.v)).toEqual([30, 90])
  })
  it('full-screen preview button exists and uses the Fullscreen API', () => {
    const s = src('components/clips/editor/editor-shell.tsx')
    expect(s).toContain('data-testid="preview-fullscreen"')
    expect(s).toContain('requestFullscreen')
  })
})
