/** TR-SHADER batch 2: web catalog, mainFrame shader progress, preview hooks. */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultEdits } from '@/lib/clips/edits'
import { mainFrame } from '@/lib/clips/editor/motion-frame'
import { PRELUDE, SHADERS } from '@/lib/clips/editor/g4/transition-shaders.gen'
import {
  CUT_ONLY_TRANSITIONS,
  MASK_TRANSITIONS,
  SHADER_TRANSITIONS,
  shaderProgress,
  transitionFrame,
  TRANSITION_INFO,
  brollTransitionWindows,
} from '@/lib/clips/editor/transitions'

const REPO = join(process.cwd(), '..')
const SHADER_DIR = join(REPO, 'worker/clips_worker/shaders')

describe('TR-SHADER web', () => {
  it('generated SHADERS match worker .glsl sources', () => {
    for (const t of SHADER_TRANSITIONS) {
      const body = readFileSync(join(SHADER_DIR, `${t}.glsl`), 'utf8')
      expect(SHADERS[t].sha256).toBe(createHash('sha256').update(body).digest('hex'))
      expect(SHADERS[t].src.trim()).toBe(body.trim())
    }
    const preludeHead = readFileSync(join(SHADER_DIR, 'prelude_head.glsl'), 'utf8').trim()
    expect(PRELUDE.trim()).toBe(preludeHead)
  })

  it('SHADER_TRANSITIONS and CUT_ONLY include the six types; MASK unchanged scope', () => {
    expect([...SHADER_TRANSITIONS].sort()).toEqual(['glitch', 'light_leak', 'ripple', 'spin', 'whip_pan', 'zoom_blur'])
    for (const t of SHADER_TRANSITIONS) {
      expect(CUT_ONLY_TRANSITIONS.has(t)).toBe(true)
      expect(MASK_TRANSITIONS.has(t)).toBe(false)
      expect(TRANSITION_INFO[t].group).toBe('Effects')
    }
  })

  it('shaderProgress matches fixture-style samples', () => {
    for (const n of [3, 12, 30, 60]) {
      for (let k = 0; k <= n; k++) {
        expect(shaderProgress(k, n)).toBe(Math.fround(Math.fround(k) / Math.fround(n)))
      }
    }
  })

  it('mainFrame spin window sets shader.progress; transitionFrame is crossfade', () => {
    const edits = {
      ...defaultEdits({ clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }),
      transitions: [{ srcMs: 5000, type: 'spin' as const, durMs: 400 }],
    }
    const tb = { segs: [[0, 5000], [5000, 10000]] as [number, number][], starts: [0, 5000], durationMs: 10000 }
    const mid = mainFrame(edits, tb, 4900, 320)
    expect(mid.cut?.shader?.type).toBe('spin')
    const n = mid.cut?.win.frames ?? 12
    const k = Math.round((mid.cut?.q ?? 0) * n)
    expect(mid.cut?.shader?.progress).toBe(shaderProgress(k, n))
    expect(transitionFrame('spin', mid.cut?.q ?? 0).wA).toBeCloseTo(1 - (mid.cut?.q ?? 0), 5)
  })

  it('brollTransitionWindows skips shader types', () => {
    const wins = brollTransitionWindows([
      { id: 'b1', source: 'stock', assetId: 'a', startMs: 0, endMs: 5000, inMs: 0, transitionIn: { type: 'spin', durMs: 400 } },
    ])
    expect(wins).toHaveLength(0)
  })
})
