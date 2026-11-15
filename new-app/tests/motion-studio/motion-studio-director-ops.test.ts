import { describe, expect, it } from 'vitest'
import { applyOps, buildBlueprint, noCurrency, validateItems } from '@/lib/motion-studio/director-ops'

const story = {
  title: 'GameStop',
  lines: [
    { id: 'l1', chapter: 1, text: 'In January 2021 a struggling GameStop traded near seventeen dollars.', hero: 'JANUARY 2021' },
    { id: 'l2', chapter: 1, text: 'Hedge funds were betting it would fail.', hero: '140%' },
    { id: 'l3', chapter: 2, text: 'Then Robinhood turned off the buy button.', hero: 'BUY' },
  ],
}
const plan = {
  world: { type: 'price_chart', reason: 'a price story' },
  style: { palette: { bg: '#0d1018', ink: '#f2f0ea', accent: '#ffc400', accent2: '#5ac8ff', muted: '#7a8296' }, mood: 'tense', grain: 0.06, glow: 0.35, vignette: 0.35 },
  scenes: [
    { index: 0, kind: 'graphics', visualType: 'title', lineIds: ['l1'], description: 'ticker opens', emphasis: [{ lineId: 'l1', word: 'GameStop' }] },
    { index: 1, kind: 'graphics', visualType: 'data', lineIds: ['l2'], description: 'red line plunges' },
    { index: 2, kind: 'handoff', visualType: 'handoff', lineIds: [], handoff: { assetId: 'a1', inS: 2, outS: 8, surface: 'tv', exitStyle: 'mirror', audioMode: 'clip' } },
    { index: 3, kind: 'graphics', visualType: 'data', lineIds: ['l3'], description: 'padlock on the button' },
  ],
  musicAnchors: { peak: { lineId: 'l3', word: 'off' } },
  musicSource: 'generated',
  layout: { scenes: [{ index: 0, visualType: 'title' }, { index: 1, visualType: 'data' }, { index: 2, visualType: 'handoff' }, { index: 3, visualType: 'data' }] },
}
const rows = plan.scenes.map(s => ({ id: `mss${s.index}`, index: s.index, kind: s.kind, visualType: s.visualType, plan: { ...s }, startMs: s.index * 5000, endMs: s.index * 5000 + 5000 }))
const assets = [{ id: 'a1', kind: 'video', filename: 'cnbc.mp4', durationMs: 30000 }, { id: 'a2', kind: 'video', filename: 'hearing.mp4', durationMs: 12000 }]
const bp = buildBlueprint({ plan, story, scenes: rows, assets, settings: { music: 'generated' } })

describe('Director blueprint', () => {
  it('exposes the pieces the reference films are built from', () => {
    expect(bp.world.type).toBe('price_chart')
    expect(bp.scenes).toHaveLength(4)
    expect(bp.scenes[0].lines[0].id).toBe('l1')
    expect(bp.scenes[0].emphasis).toEqual([{ lineId: 'l1', word: 'GameStop' }])
    expect(bp.scenes[2].handoff).toMatchObject({ assetId: 'a1', inS: 2, outS: 8, surface: 'tv' })
    expect(bp.musicAnchors.peak).toEqual({ lineId: 'l3', word: 'off' })
    expect(bp.footage.map(f => f.assetId)).toEqual(['a1', 'a2'])
  })
})

describe('validateItems', () => {
  it('keeps valid ops and says what each re-renders', () => {
    const v = validateItems([
      { text: 'Scene 2: push in on the plunge', op: { type: 'scene', sceneIndex: 1, camera: 'slow push-in on the red line' } },
      { text: 'Hit on "fail"', op: { type: 'emphasis', sceneIndex: 1, emphasis: [{ lineId: 'l2', word: 'fail' }] } },
      { text: 'Peak on buy', op: { type: 'music', anchors: { peak: { lineId: 'l3', word: 'buy' } } } },
      { text: 'Shorter excerpt', op: { type: 'footage', sceneIndex: 2, outS: 6 } },
    ], bp)
    expect(v.dropped).toEqual([])
    expect(v.items.map(i => i.effect)).toEqual([
      'Re-renders scene 2 only', 'Re-renders scene 2 only', 'Re-mixes the music only; no scene re-renders',
      'Re-cuts the footage insert in scene 3; other scenes keep their renders',
    ])
  })
  it('drops edits that do not fit the film', () => {
    const v = validateItems([
      { text: 'x', op: { type: 'emphasis', sceneIndex: 1, emphasis: [{ lineId: 'l2', word: 'rocket' }] } },   // not spoken
      { text: 'x', op: { type: 'scene', sceneIndex: 9, note: 'bigger' } },                                      // no scene 10
      { text: 'x', op: { type: 'scene', sceneIndex: 2, note: 'bigger' } },                                      // footage via footage ops
      { text: 'x', op: { type: 'footage', sceneIndex: 2, inS: 29, outS: 31 } },                                 // past the clip
      { text: 'x', op: { type: 'world', worldType: 'price_chart' } },                                           // unchanged
      { text: 'x', op: { type: 'music', source: 'upload' } },                                                   // no upload
      { text: 'x', op: { type: 'delete_everything' } },
    ], bp)
    expect(v.items).toEqual([])
    expect(v.dropped).toHaveLength(7)
  })
  it('never shows a currency sign', () => {
    expect(noCurrency('Count up to $2.75B, then $483')).toBe('Count up to 2.75 billion dollars, then 483 dollars')
    const v = validateItems([{ text: 'Scene 1: tag at $17', op: { type: 'scene', sceneIndex: 0, note: 'price tag' } }], bp)
    expect(v.items[0].text).toBe('Scene 1: tag at 17 dollars')
  })
})

describe('applyOps', () => {
  it('scene edits touch only that scene', () => {
    const v = validateItems([{ text: 's', op: { type: 'scene', sceneIndex: 1, camera: 'whip pan', visualType: 'diagram', note: 'larger labels' } }], bp)
    const r = applyOps(plan, rows, v.items.map(i => i.op), bp)
    expect([...r.affected]).toEqual([1])
    expect(r.relayout).toBe(false)
    expect(r.plan.scenes[1].visualType).toBe('diagram')
    expect(r.plan.layout.scenes[1].visualType).toBe('diagram')
    const rp = r.rowPlans.get(1)!
    expect(rp.visualType).toBe('diagram')
    expect(rp.plan.userNotes).toContain('Camera: whip pan')
    expect(rp.plan.userNotes).toContain('Director note: larger labels')
    expect(plan.scenes[1].visualType).toBe('data')               // input not mutated
  })
  it('world changes re-render graphics scenes, palette re-renders all, music only remixes', () => {
    const world = applyOps(plan, rows, [{ type: 'world', worldType: 'evidence_board' }], bp)
    expect([...world.affected].sort()).toEqual([0, 1, 3])
    const pal = applyOps(plan, rows, [{ type: 'style', palette: { accent: '#ff0000' } }], bp)
    expect([...pal.affected].sort()).toEqual([0, 1, 2, 3])
    expect(pal.plan.style.palette.accent).toBe('#ff0000')
    expect(pal.plan.style.palette.bg).toBe('#0d1018')
    const mus = applyOps(plan, rows, [{ type: 'music', anchors: { crash: { lineId: 'l3', word: 'off' } }, source: 'none' }], bp)
    expect(mus.affected.size).toBe(0)
    expect(mus.remix).toBe(true)
    expect(mus.plan.musicAnchors.crash).toEqual({ lineId: 'l3', word: 'off' })
    expect(mus.plan.musicSource).toBe('none')
  })
  it('footage edits re-time the program and swap the clip on the scene row', () => {
    const r = applyOps(plan, rows, [{ type: 'footage', sceneIndex: 2, assetId: 'a2', inS: 1, outS: 5 }], bp)
    expect(r.relayout).toBe(true)
    expect([...r.affected]).toEqual([2])
    expect(r.plan.scenes[2].handoff).toMatchObject({ assetId: 'a2', inS: 1, outS: 5, surface: 'tv' })
    expect(r.rowPlans.get(2)!.plan.handoff.assetId).toBe('a2')
  })
})
