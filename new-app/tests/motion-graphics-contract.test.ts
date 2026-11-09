import { describe, expect, it } from 'vitest'
import { patchMotionGraphics, validateMotionPlan, type MotionPlan } from '@/lib/clips/motion-graphics/contract'

const sample: MotionPlan = {
  version: 1, mode: 'clean_take', styleProfileId: null,
  fps: 30, durationMs: 5000, format: '9:16',
  graphics: [{
    id: 'g1', templateId: 'stat_counter', startMs: 1000, endMs: 3000,
    sourceEvidenceId: 'beat_1', text: '40%', box: { x: .2, y: .2, width: .5, height: .15 },
    zIndex: 2, style: { textColor: '#ffffff', accentColor: '#00aa55', fontFamily: 'Inter' },
    intro: { kind: 'scale', durationMs: 300, easing: 'out' },
    outro: { kind: 'fade', durationMs: 300, easing: 'in' },
    keyframes: [], assetIds: [], rationale: 'Illustrates verified percentage',
  }],
}
describe('AI motion graphics plan validation', () => {
  it('accepts a valid approved-output plan', () => {
    expect(validateMotionPlan(sample, { evidenceIds: new Set(['beat_1']) }).ok).toBe(true)
  })
  it('rejects graphics outside the output duration', () => {
    const bad = structuredClone(sample); bad.graphics[0]!.endMs = 6000
    expect(validateMotionPlan(bad).ok).toBe(false)
  })
  it('rejects a graphic outside platform safe bounds', () => {
    const result = validateMotionPlan(sample, { safeRect: { x: .3, y: .1, width: .6, height: .6 } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some(x => x.code === 'outside_safe_zone')).toBe(true)
  })
  it('rejects ungrounded source evidence', () => {
    expect(validateMotionPlan(sample, { evidenceIds: new Set() }).ok).toBe(false)
  })
  it('rejects non-monotone item-local keyframes', () => {
    const bad = structuredClone(sample)
    bad.graphics[0]!.keyframes = [{ atMs: 200, opacity: .2 }, { atMs: 200, opacity: .8 }]
    expect(validateMotionPlan(bad).ok).toBe(false)
  })
  it('rejects unknown AI-defined executable fields', () => {
    const bad = structuredClone(sample) as MotionPlan & { executableCode?: string }
    bad.executableCode = 'process.exit(1)'
    expect(validateMotionPlan(bad).ok).toBe(false)
  })
  it('revises one graphic without changing the input plan', () => {
    const modified = patchMotionGraphics(sample, [{ id: 'g1', patch: { text: '41%' } }])
    expect(modified.ok).toBe(true)
    if (modified.ok) expect(modified.plan.graphics[0]?.text).toBe('41%')
    expect(sample.graphics[0]?.text).toBe('40%')
  })
  it('does not allow patching graphic identity', () => {
    expect(patchMotionGraphics(sample, [{ id: 'g1', patch: { id: 'g2' } }]).ok).toBe(false)
  })
  it('prevents simultaneous graphics from obscuring each other', () => {
    const bad = structuredClone(sample)
    bad.graphics.push({ ...bad.graphics[0]!, id: 'g2',
      startMs: 1200, endMs: 2900, text: 'Another graphic' })
    const result = validateMotionPlan(bad)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some(i => i.code === 'overlapping_graphics')).toBe(true)
  })
  it('permits graphics occupying different positions or times', () => {
    const good = structuredClone(sample)
    good.graphics.push({ ...good.graphics[0]!, id: 'g2',
      startMs: 3000, endMs: 4800, text: 'Second event' })
    expect(validateMotionPlan(good).ok).toBe(true)
  })
})
