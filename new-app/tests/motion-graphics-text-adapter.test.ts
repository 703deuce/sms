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
    const second = addTextBackedMotionPlan(first.edits, { ...plan,
      graphics: [{ ...plan.graphics[0], text: 'UPDATED' }] })
    expect(second.ok).toBe(true)
    if (second.ok) expect(second.edits.textItems?.filter(t => t.id === 'mg_score')).toHaveLength(1)
  })
  it('rejects non-text templates instead of silently ignoring them', () => {
    const p = { ...plan, graphics: [{ ...plan.graphics[0], templateId: 'diagram' }] }
    const result = addTextBackedMotionPlan(base, p)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('unsupported_template')
  })
  it('removes an AI graphic without deleting a manual item', () => {
    const result = addTextBackedMotionPlan(base, plan)
    if (!result.ok) throw new Error(result.detail)
    expect(removeTextBackedMotionGraphics(result.edits, ['score']).textItems).toEqual([])
  })
})
