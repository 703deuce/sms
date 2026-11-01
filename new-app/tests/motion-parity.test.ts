import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { BrollItem } from '@/lib/clips/broll'
import { autoCrossfade } from '@/lib/clips/editor/auto-crossfade'
import { moveItems } from '@/lib/clips/editor/clip-timeline'
import { brollFrame } from '@/lib/clips/editor/motion-frame'
import { orderedStack } from '@/lib/clips/editor/layer-props'
import { addTrack } from '@/lib/clips/editor/tracks'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { layerTransformAt, trackValueAt, volumeAt, type KeyframeTrack } from '@/lib/clips/editor/keyframes'
import {
  brollTransitionWindows,
  cutTransitionWindows,
  transitionFrame,
  TRANSITION_TYPES,
} from '@/lib/clips/editor/transitions'
import { normalizeKeyframeTracks } from '@/lib/clips/editor/motion-schema'

/**
 * Preview/export parity for E3: keyframe interpolation, transition composites and windows.
 * The same JSON is asserted by worker/tests/test_motion.py (motion.py, and the ffmpeg expressions
 * it emits). Regenerate after an intentional math change: WRITE_MOTION_FIXTURE=1 npx vitest run motion-parity
 */
const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(here, '../../worker/tests/fixtures/motion_parity.json')

const TRACKS: KeyframeTrack[] = [
  { target: 'video', prop: 'x', points: [{ tMs: 0, v: -20 }, { tMs: 1000, v: 30 }, { tMs: 2500, v: 0, ease: 'inOut' }, { tMs: 4000, v: 50 }] },
  { target: 'video', prop: 'y', points: [{ tMs: 0, v: 0, bz: [1, 1] }, { tMs: 2000, v: 40, bz: [0.2, 0.9] }, { tMs: 3000, v: -10 }] },
  { target: 'video', prop: 'scale', points: [{ tMs: 200, v: 100, ease: 'in' }, { tMs: 1700, v: 250, ease: 'out' }, { tMs: 3100, v: 60 }] },
  { target: 'video', prop: 'rotation', value: 15, points: [] },
  { target: 'video', prop: 'opacity', points: [{ tMs: 500, v: 100, ease: 'out' }, { tMs: 900, v: 0 }] },
  { target: 'broll:b1', prop: 'y', points: [{ tMs: 0, v: 10 }, { tMs: 333, v: -10, ease: 'inOut' }, { tMs: 1000, v: 10 }] },
  { target: 'music', prop: 'volume', points: [{ tMs: 0, v: 100 }, { tMs: 1500, v: 20, ease: 'in' }, { tMs: 3000, v: 80 }] },
  { target: 'voice', prop: 'volume', points: [{ tMs: 1000, v: 100 }, { tMs: 1001, v: 30 }] },
  { target: 'text', prop: 'scale', points: [{ tMs: 0, v: 40, ease: 'out' }, { tMs: 400, v: 100 }] },
]
const SAMPLE_MS = [-100, 0, 1, 100, 199, 200, 250, 333, 500, 700, 899.5, 900, 1000, 1000.5, 1001, 1234, 1700, 2000, 2500, 3000, 3100, 3999, 4000, 5000]
const QS = [0, 0.05, 0.1, 0.2, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 0.95, 1]

const CUT_CASES: { name: string; segs: [number, number][]; transitions: { srcMs: number; type: string; durMs: number }[] }[] = [
  { name: 'centred', segs: [[0, 1000], [2000, 3000]], transitions: [{ srcMs: 2000, type: 'crossfade', durMs: 400 }] },
  { name: 'clamped by short segment', segs: [[10000, 10250], [11000, 14000], [15000, 15900]], transitions: [{ srcMs: 11000, type: 'push_left', durMs: 1200 }, { srcMs: 15000, type: 'dip_black', durMs: 2000 }] },
  { name: 'too short → dropped', segs: [[0, 90], [500, 2000]], transitions: [{ srcMs: 500, type: 'blur', durMs: 400 }] },
  { name: 'odd times', segs: [[1234, 2345], [3456, 4567], [5678, 9999]], transitions: [{ srcMs: 3456, type: 'wipe_up', durMs: 333 }, { srcMs: 5678, type: 'zoom_in', durMs: 517 }] },
  { name: 'no match', segs: [[0, 1000], [2000, 3000]], transitions: [{ srcMs: 1500, type: 'crossfade', durMs: 400 }] },
]
const BROLL_CASE = [
  { id: 'a', source: 'stock', assetId: 'x', startMs: 500, endMs: 1500, transitionIn: { type: 'crossfade', durMs: 300 } },
  { id: 'b', source: 'stock', assetId: 'y', startMs: 1520, endMs: 2500, transitionIn: { type: 'wipe_left', durMs: 400 }, transitionOut: { type: 'dip_black', durMs: 300 } },
  { id: 'c', source: 'stock', assetId: 'z', startMs: 4000, endMs: 4300, transitionIn: { type: 'zoom_out', durMs: 2000 }, transitionOut: { type: 'blur', durMs: 2000 } },
  { id: 'd', source: 'stock', assetId: 'w', startMs: 4300, endMs: 6000, transitionOut: { type: 'push_up', durMs: 500 } },
] as unknown as BrollItem[]

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const br = (id: string, a: number, b: number): BrollItem => ({ id, source: 'stock', assetId: id, startMs: a, endMs: b, inMs: 0 })

function crossTrackBlock() {
  let e: ClipEditsV2 = { ...normalizeEdits(defaultEdits(bounds), bounds), broll: [br('a', 0, 4000), br('b', 5000, 7000)] }
  const added = addTrack(e, 'overlay')!
  e = {
    ...added.edits,
    tracks: added.edits.tracks!.map((t) => (t.id === added.trackId ? { ...t, items: ['b'] } : t)),
  }
  const m = moveItems({ edits: e, previewEdits: e }, [{ lane: 'broll', id: 'b' }], -1600)!
  const edits = autoCrossfade(e, m, e, m, [{ lane: 'broll', id: 'b' }], undefined, true)
  const topId = orderedStack(edits, 'broll', edits.broll ?? []).slice(-1)[0]!.id
  const startMs = 3400
  const endMs = 4000
  const samples = [startMs, 3700, endMs].map((t) => ({
    t,
    topId,
    opacity: brollFrame(edits, t, 360).items[topId]?.box?.opacity ?? 0,
  }))
  return { edits, topId, samples }
}

function generate() {
  const edits = { keyframes: TRACKS } as unknown as ClipEditsV2
  const keyframes = TRACKS.map((t) => ({
    target: t.target,
    prop: t.prop,
    values: SAMPLE_MS.map((ms) => trackValueAt(t, t.prop, ms)),
  }))
  return {
    tracks: TRACKS,
    sampleMs: SAMPLE_MS,
    keyframes,
    layer: SAMPLE_MS.map((ms) => layerTransformAt(edits, 'video', ms)),
    volume: SAMPLE_MS.map((ms) => volumeAt(edits, 'music', ms)),
    qs: QS,
    frames: Object.fromEntries(TRANSITION_TYPES.map((t) => [t, QS.map((q) => transitionFrame(t, q))])),
    cutCases: CUT_CASES.map((c) => {
      const starts: number[] = []
      let acc = 0
      for (const [a, b] of c.segs) {
        starts.push(acc)
        acc += b - a
      }
      return { ...c, expected: cutTransitionWindows(c.segs, starts, c.transitions as never) }
    }),
    broll: { items: BROLL_CASE, expected: brollTransitionWindows(BROLL_CASE) },
    crossTrack: crossTrackBlock(),
  }
}

describe('E3 motion parity fixture (web ↔ worker)', () => {
  if (process.env.WRITE_MOTION_FIXTURE) writeFileSync(FIXTURE, JSON.stringify(generate(), null, 1) + '\n')
  const fixture = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : null

  it('fixture exists and matches the current math', () => {
    expect(fixture).not.toBeNull()
    expect(JSON.parse(JSON.stringify(generate()))).toEqual(fixture)
  })

  it('normalizer keeps the fixture tracks as-is', () => {
    expect(normalizeKeyframeTracks(TRACKS)).toEqual(TRACKS)
  })
})
