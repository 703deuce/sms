// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { Timeline } from '@/components/clips/editor/timeline'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import type { ClipMediaSource } from '@/lib/clips/editor/sources'
import { applyMulticamSegments } from '@/lib/clips/editor/sources'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import {
  angleAt,
  angleKey,
  multicamAngles,
  nudgeSync,
  resetSync,
  setAngleForOutputRange,
  setAngleForRange,
  switchAngleAt,
} from '@/lib/clips/editor/multicam-manual'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const cam2: ClipMediaSource = { id: 'u2', ref: 'upload', refId: 'u2', mediaType: 'video', label: 'Cam B', syncMs: 120 }
const cam3: ClipMediaSource = { id: 'u3', ref: 'upload', refId: 'u3', mediaType: 'video', label: 'Cam C', syncMs: -40 }
const lib = [cam2, cam3]
const base = (patch: Partial<ClipEditsV2> = {}): ClipEditsV2 => ({ ...normalizeEdits(defaultEdits(bounds), bounds), ...patch })

describe('G1b2 manual multicam model (E5 source segments)', () => {
  it('angles: main + clip sources + synced library angles, clip copy wins', () => {
    const e = base({ sources: [{ ...cam2, syncMs: 150 }] })
    const a = multicamAngles(e, lib)
    expect(a.map((x) => [x.key, x.sourceId])).toEqual([[1, 'main'], [2, 'u2'], [3, 'u3']])
  })
  it('live switch cuts at the playhead and holds until the next switch; main clears', () => {
    let e = switchAngleAt(base(), 5000, 'u2', lib)
    expect(e.sources?.map((s) => s.id)).toEqual(['u2'])
    expect(e.sourceSegments).toEqual([{ id: 'mc-5000', sourceId: 'u2', startMs: 5000, endMs: 20000 }])
    e = switchAngleAt(e, 9000, 'u3', lib)
    expect([angleAt(e, 6000), angleAt(e, 9500), angleAt(e, 19000)]).toEqual(['u2', 'u3', 'u3'])
    e = switchAngleAt(e, 12000, 'main', lib)
    expect([angleAt(e, 11000), angleAt(e, 13000)]).toEqual(['u3', 'main'])
    // Switching before an existing cut holds only up to it.
    e = switchAngleAt(e, 2000, 'u3', lib)
    expect([angleAt(e, 3000), angleAt(e, 5500)]).toEqual(['u3', 'u2'])
  })
  it('range (timeline section / transcript words) and output range across a cut', () => {
    const e = setAngleForRange(base(), 1000, 3000, 'u3', lib)
    expect(e.sourceSegments).toEqual([{ id: 'mc-1000', sourceId: 'u3', startMs: 1000, endMs: 3000 }])
    const cut = base({ cutRanges: [[4000, 6000]] })
    const out = setAngleForOutputRange(cut, timebaseFor(cut), 3000, 6000, 'u2', lib)
    expect(out.sourceSegments?.map((s) => [s.startMs, s.endMs])).toEqual([[3000, 4000], [6000, 8000]])
  })
  it('nudge sync and reset to the audio value; manual segments survive auto-switch regeneration', () => {
    let e = setAngleForRange(base(), 1000, 3000, 'u2', lib)
    e = nudgeSync(e, 'u2', 33.3)
    expect(e.sources![0]!.syncMs).toBe(153)
    expect(resetSync(e, cam2).sources![0]!.syncMs).toBe(120)
    const regen = applyMulticamSegments(e.sourceSegments, [{ id: 'a1', sourceId: 'u3', startMs: 0, endMs: 20000, auto: true }], 0, 20000, [...e.sources!, cam3])
    expect(regen!.find((s) => s.id === 'mc-1000')).toBeTruthy()
  })
  it('angleKey', () => {
    expect(angleKey({ key: '3' })).toBe(3)
    expect(angleKey({ key: '0' })).toBeNull()
    expect(angleKey({ key: '2', ctrlKey: true })).toBeNull()
  })
})

describe('G1b2 timeline keys 1–9', () => {
  afterEach(() => cleanup())
  it('pressing 2 at the playhead switches to the second angle (one commit)', () => {
    const onCommitEdits = vi.fn()
    render(
      <Timeline
        edits={base()}
        words={[]}
        shots={[]}
        outputMs={4000}
        clipOutputDurationMs={20000}
        onSeekOutput={() => {}}
        clipStartMs={0}
        clipEndMs={20000}
        trimMinMs={0}
        trimMaxMs={40000}
        onCommitEdits={onCommitEdits}
        angleSources={lib}
      />,
    )
    fireEvent.keyDown(window, { key: '2' })
    expect(onCommitEdits).toHaveBeenCalledTimes(1)
    const next = onCommitEdits.mock.calls[0]![0] as ClipEditsV2
    expect(angleAt(next, 5000)).toBe('u2')
    expect(angleAt(next, 3000)).toBe('main')
  })
})
