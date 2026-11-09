import { describe, expect, it } from 'vitest'
import { addTextBackedMotionPlan, removeTextBackedMotionGraphics } from '@/lib/clips/motion-graphics/text-adapter'
import type { MotionPlan } from '@/lib/clips/motion-graphics/contract'
import { defaultEdits } from '@/lib/clips/edits'
const bounds = { clipStartMs: 0, clipEndMs: 7000 }
const base = defaultEdits(bounds)
const plan: MotionPlan = {
  version: 1, mode: 'streamer_continuous', styleProfileId: null, fps: 30,
  format: '9:16', durationMs: 7000,
  graphics: [{ id: 'score', templateId: 'gaming_highlight',
    startMs: 1000, endMs: 4000, text: 'NEW RECORD',
    box: { x: .2, y: .2, width: .6, height: .1 }, zIndex: 1,
    style: { fontFamily: 'Montserrat', textColor: '#ffffff', accentColor: '#00aa55' },
    intro: { kind: 'slide', durationMs: 300, easing: 'out' },
    outro: { kind: 'fade', durationMs: 200, easing: 'in' },
    keyframes: [], assetIds: [], rationale: 'Verified game result' }],
}
describe('motion plan adapter to existing editor & FFmpeg text layers', () => {
  it('creates an editable, timed text layer without touching footage edits', () => {
    const result = addTextBackedMotionPlan(base, plan)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.edits.textItems?.[0]?.id).toBe('mg_score')
    expect(result.edits.textItems?.[0]?.anim?.in?.type).toBe('slide_up')
    expect(result.edits.trim).toEqual(base.trim)
    expect(base.textItems).toBeUndefined()
  })
  it('replaces the same AI layer ID while retaining other editor text', () => {
    const first = addTextBackedMotionPlan(base, plan)
    if (!first.ok) throw new Error(first.detail)
    const second = addTextBackedMotionPlan({ ...first.edits, motionPlan: plan }, { ...plan,
      graphics: [{ ...plan.graphics[0], text: 'UPDATED' }] })
    expect(second.ok).toBe(true)
    if (second.ok) expect(second.edits.textItems?.filter(t => t.id === 'mg_score')).toHaveLength(1)
  })
  it('rejects diagrams missing required step data instead of silently ignoring them', () => {
    const p = { ...plan, graphics: [{ ...plan.graphics[0], templateId: 'diagram' }] }
    const result = addTextBackedMotionPlan(base, p)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_shape_data')
  })
  it('removes an AI graphic without deleting a manual item', () => {
    const result = addTextBackedMotionPlan(base, plan)
    if (!result.ok) throw new Error(result.detail)
    expect(removeTextBackedMotionGraphics({ ...result.edits, motionPlan: plan }, ['score']).textItems).toEqual([])
  })
  it('compiles a data-driven infographic into editable shape and text layers', () => {
    const diagram = { ...plan, graphics: [{
      ...plan.graphics[0], id: 'how_it_works', templateId: 'diagram' as const,
      text: undefined,
      box: { x: .12, y: .2, width: .7, height: .45 },
      steps: ['Record', 'Clip', 'Publish'],
    }] }
    const result = addTextBackedMotionPlan(base, diagram)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.edits.textItems?.some(t => t.kind === 'shape')).toBe(true)
    expect(result.edits.textItems?.some(t => t.text === 'Publish')).toBe(true)
    expect(result.edits.textItems?.every(t => t.id.startsWith('mg_how_it_works__'))).toBe(true)
  })
  it('renders chart bars only from explicit validated numeric data', () => {
    const chart = { ...plan, graphics: [{
      ...plan.graphics[0], id: 'revenue', templateId: 'bar_chart' as const,
      text: undefined,
      box: { x: .15, y: .15, width: .75, height: .4 },
      bars: [{ label: '2025', value: 20 }, { label: '2026', value: 40 }],
    }] }
    const result = addTextBackedMotionPlan(base, chart)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.edits.textItems?.filter(t => t.kind === 'shape')).toHaveLength(2)
    expect(result.edits.textItems?.filter(t => t.text === '40')).toHaveLength(1)
  })
  it('rejects graphic charts without values', () => {
    const chart = { ...plan, graphics: [{ ...plan.graphics[0],
      templateId: 'bar_chart' as const, bars: [] }] }
    expect(addTextBackedMotionPlan(base, chart).ok).toBe(false)
  })

  it('does not overwrite a manually authored text layer with a generated-looking ID', () => {
    const first = addTextBackedMotionPlan(base, plan)
    if (!first.ok) throw new Error(first.detail)
    const manual = { ...first.edits, motionPlan: undefined }
    const collision = addTextBackedMotionPlan(manual, plan)
    expect(collision.ok).toBe(false)
    if (!collision.ok) expect(collision.code).toBe('id_collision')
    expect(removeTextBackedMotionGraphics(manual, ['score']).textItems).toEqual(first.edits.textItems)
  })
  it('removes every child shape and label of an approved AI chart, but preserves manual text', () => {
    const chartPlan: MotionPlan = { ...plan, graphics: [{ ...plan.graphics[0],
      id: 'chart', templateId: 'bar_chart', text: undefined,
      box: { x: .15, y: .15, width: .75, height: .4 },
      bars: [{ label: 'Earlier', value: 20 }, { label: 'Later', value: 40 }],
    }] }
    const result = addTextBackedMotionPlan(base, chartPlan)
    if (!result.ok) throw new Error(result.detail)
    const approved = { ...result.edits, motionPlan: chartPlan }
    const after = removeTextBackedMotionGraphics(approved, ['chart'])
    expect(after.textItems).toEqual([])
  })
  it('preserves the old approved graphic when the new plan has a different ID until replaced explicitly', () => {
    const first = addTextBackedMotionPlan(base, plan)
    if (!first.ok) throw new Error(first.detail)
    const next = { ...plan, graphics: [{ ...plan.graphics[0], id: 'new' }] }
    const second = addTextBackedMotionPlan({ ...first.edits, motionPlan: plan }, next)
    if (!second.ok) throw new Error(second.detail)
    expect(second.edits.textItems?.map(i => i.id).sort()).toEqual(['mg_new', 'mg_score'])
  })
  it('maps AI position, scale, rotation and opacity to editable item-local keyframes', () => {
    const animated: MotionPlan = { ...plan, graphics: [{
      ...plan.graphics[0], keyframes: [
        { atMs: 0, x: .5, y: .25, scale: 1, rotation: 0, opacity: 0 },
        { atMs: 350, x: .6, y: .3, scale: 1.25, rotation: 15, opacity: 1 },
      ],
    }] }
    const result = addTextBackedMotionPlan(base, animated)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.edits.keyframes?.map(t => t.prop).sort())
      .toEqual(['opacity', 'rotation', 'scale', 'x', 'y'])
    expect(result.edits.keyframes?.find(t => t.prop === 'x')?.points[1]?.v).toBeCloseTo(10)
    const clean = removeTextBackedMotionGraphics({ ...result.edits, motionPlan: animated }, ['score'])
    expect(clean.keyframes).toEqual([])
    expect(clean.textItems).toEqual([])
  })
  it('rejects unsupported keyframe scale instead of letting export silently clamp it', () => {
    const animated: MotionPlan = { ...plan, graphics: [{
      ...plan.graphics[0], keyframes: [{ atMs: 100, scale: 7 }],
    }] }
    const result = addTextBackedMotionPlan(base, animated)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_shape_data')
  })
})
