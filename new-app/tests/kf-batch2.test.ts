/**
 * KF batch 2: KF-10 chroma keyframes, KF-12 caption motion, KF-16 motion path polyline.
 */
import { describe, expect, it } from 'vitest'
import { chromaKeyAt, DEFAULT_KEY, MASK_STEP_MS, type ChromaKey } from '@/lib/clips/editor/layer-fx'
import { captionAssMotionTags, captionMotionAt } from '@/lib/clips/editor/caption-keyframes'
import { motionPathPoints, motionPathVisible } from '@/lib/clips/editor/motion-path'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { buildCaptionsAss } from '@/lib/clips/render-plan/captions-ass'

const baseEdits = (): ClipEditsV2 => ({ version: 2 })

describe('KF-10 chroma keyframes', () => {
  const keyed: ChromaKey = {
    ...DEFAULT_KEY,
    sim: 30,
    keys: [
      { ms: 0, sim: 40, blend: 10, spill: 50 },
      { ms: 1000, sim: 80, blend: 20, spill: 60 },
    ],
  }

  it('steps on 100 ms grid and linearly interpolates sim/blend/spill', () => {
    expect(chromaKeyAt(keyed, 0).sim).toBe(40)
    expect(chromaKeyAt(keyed, 50).sim).toBe(40)
    expect(chromaKeyAt(keyed, 500).sim).toBe(60)
    expect(chromaKeyAt(keyed, 1000).blend).toBe(20)
    expect(chromaKeyAt(keyed, 5000).sim).toBe(80)
  })

  it('keeps key color fixed', () => {
    expect(chromaKeyAt(keyed, 500).color).toBe(DEFAULT_KEY.color)
  })

  it('floors local ms to MASK_STEP_MS', () => {
    expect(chromaKeyAt(keyed, 999).sim).toBe(chromaKeyAt(keyed, 900).sim)
  })
})

describe('KF-12 caption motion', () => {
  it('captionMotionAt reads output-ms tracks', () => {
    const edits = {
      keyframes: [
        { target: 'captions', prop: 'capX', points: [{ tMs: 0, v: 0 }, { tMs: 2000, v: 10 }] },
        { target: 'captions', prop: 'capScale', value: 120, points: [] },
      ],
    } as unknown as ClipEditsV2
    expect(captionMotionAt(edits, 1000).xPct).toBe(5)
    expect(captionMotionAt(edits, 1000).scalePct).toBe(120)
  })

  it('ASS tags empty at defaults', () => {
    expect(captionAssMotionTags({ xPct: 0, yPct: 0, scalePct: 100 }, 1080, 1920, 2, 120)).toBe('')
  })

  it('buildCaptionsAss injects motion tags when keyframes exist', () => {
    const edits = {
      keyframes: [{ target: 'captions', prop: 'capY', points: [{ tMs: 0, v: 5 }] }],
    } as unknown as ClipEditsV2
    const ass = buildCaptionsAss([{ w: 'hi', s: 0, e: 1, i: 0 }], { presetId: 'bold_pop' }, 1080, 1920, edits)
    expect(ass).toContain('\\pos(')
    expect(ass).toContain('\\fscx')
  })
})

describe('KF-16 motion path', () => {
  it('visible when at least two x/y key times', () => {
    const edits = {
      keyframes: [
        { target: 'video', prop: 'x', points: [{ tMs: 0, v: 0 }, { tMs: 1000, v: 10 }] },
        { target: 'video', prop: 'y', points: [{ tMs: 0, v: 0 }, { tMs: 1000, v: -5 }] },
      ],
    } as unknown as ClipEditsV2
    expect(motionPathVisible(edits, 'video')).toBe(true)
    const pts = motionPathPoints(edits, 'video')
    expect(pts.length).toBe(2)
    expect(pts[1]?.xPct).toBe(10)
    expect(pts[1]?.yPct).toBe(-5)
  })

  it('hidden for captions target', () => {
    expect(motionPathVisible(baseEdits(), 'captions')).toBe(false)
  })
})
