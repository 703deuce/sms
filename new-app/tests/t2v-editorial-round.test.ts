import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: vi.fn() }))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn(), logT2vError: vi.fn() }))
vi.mock('@/lib/server/t2v/stock-asset', () => ({ ensureT2vStockAsset: async (_w: string, c: { providerId: string }) => ({ id: `asset_${c.providerId}` }) }))
import { t2vFinisher } from '@/lib/server/t2v/pipeline/t2v-finisher'
import { enforceNoRepeatDeterministic, nearIdenticalShot } from '@/lib/server/t2v/pipeline/t2v-no-repeat'
import { autoPieces, pacingStats, planPacing, type T2vPacingRow } from '@/lib/server/t2v/pipeline/t2v-pacing'
import { specificSubject } from '@/lib/server/t2v/pipeline/t2v-scene-planner'

const hash = () => [Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')]
const cand = (id: string, kind?: 'photo') => ({ provider: 'pixabay' as const, providerId: id, previewUrl: 'p', durationS: 20, width: 1920, height: 1080, query: 'q', tags: [], srcUrl: 's', thumbUrl: 't', pageUrl: 'u', author: 'a', ...(kind ? { kind } : {}) })
const ev = (id: string, o: Record<string, unknown> = {}) => ({ provider: 'pixabay', providerId: id, visible: '', matches: true, score: 8, inS: 0, outS: 6, clipS: 20, style: 'live_action', lighting: 7, phash: hash(), verdict: 'accepted', ...o })
const shot = (sceneId: string, narration: string, voiceGroup: string, extra: Record<string, unknown> = {}) => ({ sceneId, segmentId: 's1', narration, intent: 'i', queries: ['coffee roaster'], subject: 'coffee roaster', needS: 3, voiceGroup, ...extra })
const finish = (shots: unknown[], results: unknown[], candidates: Record<string, unknown[]>, banned?: Record<string, string[]>) =>
  t2vFinisher({
    workspaceId: 'w',
    doc: { settings: { captionsEnabled: true } } as never,
    run: { style: 'documentary', prompt: 'coffee' } as never,
    story: { title: 'Coffee' } as never,
    segments: [],
    shots: shots as never,
    results: results as never,
    candidates: candidates as never,
    banned,
  })

// The 18 sentences of the coffee re-run (beats from that run's planner).
const COFFEE: Array<[string, T2vPacingRow['beat']]> = [
  ['A morning cup begins far from the kitchen, among coffee trees on a mountain farm.', 'establishing'],
  ['Follow the bean from fruit to familiar drink.', 'transition'],
  ['In warm climates, farmers tend coffee trees beneath shifting sunlight and clouds.', 'establishing'],
  ['Blossoms become green cherries, slowly ripening on branches.', 'detail'],
  ['Farmers watch for deep color, a sign the fruit is ready.', 'detail'],
  ['Harvesters pick ripe cherries by hand.', 'action'],
  ['On some farms, they gather fruit as it matures, sorting ripe cherries from green ones.', 'action'],
  ['Each harvest holds months of work in a handful of fruit.', 'emotional'],
  ['After picking, cherries are processed to separate beans from fruit.', 'step'],
  ['Beans are washed or prepared by other methods, then spread to dry beneath open skies.', 'step'],
  ['Workers turn and sort them for the next stage.', 'step'],
  ['Dried green beans travel to a roaster, where heat changes their appearance and scent.', 'transition'],
  ['In the drum, pale beans deepen in color and release a rich aroma.', 'detail'],
  ['Roasting develops flavors that emerge when coffee is brewed.', 'step'],
  ['Roasted beans are ground just before hot water passes through them.', 'step'],
  ['Water draws out flavor, filling a cup made through many careful steps.', 'detail'],
  ['From mountain farm to morning table, the journey is there in every sip.', 'emotional'],
  ['Next time you brew, notice the hands and places behind it.', 'transition'],
]
const rows: T2vPacingRow[] = COFFEE.map(([narration, beat], i) => ({ segmentId: `seg${Math.floor(i / 4)}`, narration, beat, intent: 'i', queries: ['q'], subject: 's' }))

describe('t2v editorial round', () => {
  it('plans reach CV >= 0.3 with no metronomic run, for many seeds and every style; words never change', () => {
    for (const style of ['documentary', 'educational', 'explainer', 'marketing', 'social'] as const) {
      for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
        const plan = planPacing(rows, { style, seed })
        const st = pacingStats(plan.map((s) => s.needS))
        expect(st.cv).toBeGreaterThanOrEqual(0.3)
        expect(st.longestEqualRun).toBeLessThan(3)
        expect(plan.map((s) => s.narration).join(' ')).toBe(COFFEE.map(([n]) => n).join(' '))
      }
    }
  })
  it('long beats get real holds (6-10 s) and steps cut at 2-4 s; plans differ per video', () => {
    const plan = planPacing(rows, { style: 'documentary', seed: 'coffee' })
    expect(plan.some((s) => s.needS >= 6 && ['establishing', 'emotional', 'aerial'].includes(s.beat))).toBe(true)
    expect(plan.every((s) => s.needS <= 10.5)).toBe(true)
    const steps = plan.filter((s) => s.beat === 'step')
    expect(steps.filter((s) => s.needS <= 4.2).length).toBeGreaterThanOrEqual(3)
    expect(new Set(['1', '2', '3', '4'].map((k) => planPacing(rows, { style: 'documentary', seed: k }).map((s) => s.needS).join(','))).size).toBeGreaterThan(1)
  })
  it('auto pieces cut at pauses, verbatim, each >= 4 words', () => {
    const p = autoPieces(rows[9]!)!
    expect(p.length).toBeGreaterThanOrEqual(2)
    expect(p.map((x) => x.text).join(' ')).toBe(rows[9]!.narration)
    expect(p.every((x) => x.text.split(' ').length >= 4)).toBe(true)
    expect(autoPieces({ ...rows[5]! })).toBeUndefined() // "Harvesters pick ripe cherries by hand." has no pause
  })
  it('specific subjects: bare generic nouns are replaced by the most specific query', () => {
    expect(specificSubject('coffee beans', ['coffee beans', 'burlap sacks green beans', 'warehouse'], 'x')).toBe('burlap sacks green beans')
    expect(specificSubject('coffee roasting drum', ['roaster'], 'x')).toBe('coffee roasting drum')
    expect(specificSubject('coffee cherries', ['q'], 'x')).toBe('coffee cherries')
  })
  it('every split piece gets its own clip: no held second half, never a card; fallback skips banned clips', async () => {
    const shots = [shot('a', 'Dried green beans travel to a roaster,', 'vg_0'), shot('b', 'where heat changes their scent.', 'vg_0'), shot('c', 'In the drum, pale beans deepen.', 'vg_1')]
    const results = [
      { sceneId: 'a', chosen: ev('1'), evaluated: [ev('1')] },
      // b: only a banned 9 and a weak 2 for its line; c reviewed a roaster photo (4) usable as closest related.
      { sceneId: 'b', chosen: null, evaluated: [ev('9', { score: 9 }), ev('img_5', { score: 2, kind: 'photo', lighting: 8, subject: 'coffee roaster' })] },
      { sceneId: 'c', chosen: null, evaluated: [ev('7', { score: 4, subject: 'coffee roaster drum', visible: 'a coffee roaster drum turning', lighting: 9 })] },
    ]
    const { scenes, results: out } = await finish(shots, results, { a: [cand('1')], b: [cand('9'), cand('img_5', 'photo')], c: [cand('7')] }, { b: ['9'] })
    const real = scenes.filter((s) => !s.id.startsWith('sc_end'))
    expect(real.every((s) => s.media.kind !== 'color')).toBe(true)
    expect(real[0]!.cuts).toEqual([{ atWord: 7, media: expect.objectContaining({ providerId: 'img_5', kind: 'image' }) }])
    expect(out.map((r) => r.pickedBy)).toEqual(['accepted', 'last_resort', 'fallback'])
    expect(out[1]!.chosen).toMatchObject({ kind: 'photo', lighting: 8 })
    expect(out[2]!.chosen).toMatchObject({ lighting: 9 })
    expect(out.some((r) => r.outcome === 'held' || r.outcome === 'title_card')).toBe(false)
  })
  it('a line with nothing of its own takes the closest related clip reviewed for another line', async () => {
    const shots = [shot('a', 'Beans tumble in the roaster.', 'vg_0'), shot('b', 'The roaster drum glows with heat.', 'vg_1', { subject: 'coffee roaster drum' })]
    const results = [
      { sceneId: 'a', chosen: ev('1'), evaluated: [ev('1'), ev('3', { score: 6, subject: 'coffee roaster', visible: 'an industrial coffee roaster drum' }), ev('4', { score: 6, subject: 'coffee cup', visible: 'a cup of coffee' })] },
      { sceneId: 'b', chosen: null, evaluated: [] },
    ]
    const { results: out } = await finish(shots, results, { a: [cand('1'), cand('3'), cand('4')], b: [] })
    expect(out[1]!.chosen!.providerId).toBe('3')
    expect(out[1]!.outcome).toBe('stock')
  })
  it('at most 2 stills in a row; no near-identical neighbours', () => {
    const s = (id: string) => ({ sceneId: id, narration: '', intent: '' }) as never
    const ph = (id: string, score = 9) => ev(id, { kind: 'photo', score })
    const data = {
      a: { sceneId: 'a', chosen: null, evaluated: [ph('img_1')] },
      b: { sceneId: 'b', chosen: null, evaluated: [ph('img_2')] },
      c: { sceneId: 'c', chosen: null, evaluated: [ph('img_3'), ev('30', { score: 5, matches: false })] },
    }
    const r = enforceNoRepeatDeterministic([s('a'), s('b'), s('c')], data as never, { realistic: true })
    expect(r.out.c!.chosen!.providerId).toBe('30')
    const beansA = { subject: 'roasted coffee beans', framing: 'close-up', action: 'falling onto a pile' }
    const beansB = { subject: 'roasted coffee beans', framing: 'close-up', action: 'beans falling onto pile' }
    expect(nearIdenticalShot(beansA, beansB)).toBe(true)
    expect(nearIdenticalShot(beansA, { ...beansB, framing: 'wide' })).toBe(false)
    expect(nearIdenticalShot(beansA, { subject: 'coffee roaster drum', framing: 'close-up', action: 'turning' })).toBe(false)
    const seq = {
      a: { sceneId: 'a', chosen: null, evaluated: [ev('1', beansA)] },
      b: { sceneId: 'b', chosen: null, evaluated: [ev('2', { ...beansB, score: 9 }), ev('3', { score: 6, subject: 'roaster drum', framing: 'medium', action: 'turning' })] },
    }
    expect(enforceNoRepeatDeterministic([s('a'), s('b')], seq as never, { realistic: true }).out.b!.chosen!.providerId).toBe('3')
  })
})

describe('t2v finisher sequence rules', () => {
  it('a fallback photo never makes a third still in a row when a video option exists', async () => {
    const shots = [shot('a', 'one two three four', 'vg_0'), shot('b', 'five six seven eight', 'vg_1'), shot('c', 'nine ten eleven twelve', 'vg_2')]
    const results = [
      { sceneId: 'a', chosen: ev('img_1', { kind: 'photo' }), evaluated: [] },
      { sceneId: 'b', chosen: ev('img_2', { kind: 'photo' }), evaluated: [] },
      { sceneId: 'c', chosen: null, evaluated: [ev('img_3', { kind: 'photo', score: 4 }), ev('30', { score: 3 })] },
    ]
    const { results: out } = await finish(shots, results, { a: [cand('img_1', 'photo')], b: [cand('img_2', 'photo')], c: [cand('img_3', 'photo'), cand('30')] })
    expect(out[2]!.chosen!.providerId).toBe('30')
  })
})
