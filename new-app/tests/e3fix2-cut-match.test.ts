import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  cutMatchToleranceMs,
  cutTransitionWindows,
  remapCutTransitions,
  setCutTransition,
  transitionAtCut,
} from '@/lib/clips/editor/transitions'
import type { CutTransition } from '@/lib/clips/editor/transitions'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'

/** E3fix2: nearest cut within half a frame — same results as worker motion.match_transitions_to_cuts. */
const here = path.dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(path.resolve(here, '../../worker/tests/fixtures/cut_match_parity.json'), 'utf8'),
) as {
  cases: {
    id: string
    fps: number
    segs: [number, number][]
    transitions: CutTransition[]
    expected: { k: number; srcMs: number; type: string; startFrame: number; frames: number }[]
  }[]
}

function startsOf(segs: [number, number][]): number[] {
  let acc = 0
  return segs.map(([a, b]) => {
    const s = acc
    acc += b - a
    return s
  })
}

describe('E3fix2: cut ↔ transition matching (TS ↔ worker parity)', () => {
  it('half a frame', () => {
    expect(cutMatchToleranceMs(30)).toBeCloseTo(16.6667, 3)
    expect(cutMatchToleranceMs(25)).toBe(20)
  })

  it.each(fixture.cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const got = cutTransitionWindows(c.segs, startsOf(c.segs), c.transitions, c.fps).map((w) => ({
      k: w.k,
      srcMs: w.srcMs,
      type: w.type,
      startFrame: w.startFrame,
      frames: w.frames,
    }))
    expect(got).toEqual(c.expected)
  })

  it('timeline handle state, re-set and remap use the same tolerance (and heal the key)', () => {
    const segs: [number, number][] = [[0, 4860], [5140, 6140]]
    const trs: CutTransition[] = [{ srcMs: 5146, type: 'push_left', durMs: 500 }]
    expect(transitionAtCut(segs, trs, 5140)?.type).toBe('push_left')
    const bounds = { clipStartMs: 0, clipEndMs: 20000 }
    const e = { ...normalizeEdits(defaultEdits(bounds), bounds), transitions: trs }
    const next = setCutTransition(e, 5140, { type: 'crossfade', durMs: 400 })
    expect(next.transitions).toEqual([{ srcMs: 5140, type: 'crossfade', durMs: 400 }])
    expect(remapCutTransitions(trs, segs, segs)).toEqual([{ srcMs: 5140, type: 'push_left', durMs: 500 }])
  })
})
