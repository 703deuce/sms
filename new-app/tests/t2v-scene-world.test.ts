import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: vi.fn() }))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn(), logT2vError: vi.fn() }))
vi.mock('@/lib/server/t2v/stock-asset', () => ({ ensureT2vStockAsset: async (_w: string, c: { providerId: string }) => ({ id: `asset_${c.providerId}` }) }))
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import { normalizeSceneWorld, worldLine, worldPrompt } from '@/lib/server/t2v/pipeline/t2v-context'
import { t2vStoryAgent } from '@/lib/server/t2v/pipeline/t2v-story-agent'
import { t2vScenePlanner } from '@/lib/server/t2v/pipeline/t2v-scene-planner'
import { enforceNoRepeatDeterministic, subjectRepeatPenalty, t2vLitOk, t2vQualityOk } from '@/lib/server/t2v/pipeline/t2v-no-repeat'
import { t2vFinisher } from '@/lib/server/t2v/pipeline/t2v-finisher'
import { aiBrollPrompts, fallbackAiPrompt } from '@/lib/server/t2v/pipeline/t2v-ai-broll'
import { pieceBriefs } from '@/lib/server/t2v/pipeline/t2v-pacing'

const llm = vi.mocked(t2vLlmJson)
beforeEach(() => llm.mockReset())

const SNOW_RAW = {
  summary: 'Preparing a home for a winter snowstorm before the first flakes arrive.',
  viewer: 'a homeowner getting ready for a storm',
  situation: 'the days before a winter storm, at home',
  setting: 'a house, its rooms and yard',
  timeOfDay: '',
  season: 'winter, snow',
  mood: 'calm, practical',
  plausible: ['snowy yards', 'home interiors', 'storm supplies'],
  implausible: ['summer barbecue', 'sunny beach', 'laboratories'],
  fallbackQueries: ['snowy house', 'winter window!', 'storm supplies'],
}
const SNOW = normalizeSceneWorld(SNOW_RAW, 'home snowstorm preparation')!

// Random 64-bit hashes: two of them are within 10 bits with negligible probability.
const hash = () => [Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')]
const ev = (id: string, o: Record<string, unknown> = {}) => ({ provider: 'pixabay', providerId: id, visible: '', matches: true, score: 8, inS: 0, outS: 6, clipS: 20, style: 'live_action', lighting: 8, phash: hash(), timeOfDay: 'day', ...o })
const shot = (sceneId: string, narration: string, o: Record<string, unknown> = {}) => ({ sceneId, segmentId: 's', narration, intent: narration, queries: ['q'], needS: 3, voiceGroup: sceneId, ...o }) as never
const cand = (id: string) => ({ provider: 'pixabay' as const, providerId: id, previewUrl: 'p', durationS: 20, width: 1920, height: 1080, query: 'q', tags: [], srcUrl: 's', thumbUrl: 't', pageUrl: 'u', author: 'a' })

describe('t2v scene world: derivation', () => {
  it('normalizes the LLM world (free-form, no keyword lists) and renders it for prompts', () => {
    expect(SNOW.season).toBe('winter, snow')
    expect(SNOW.fallbackQueries).toEqual(['snowy house', 'winter window', 'storm supplies'])
    expect(worldPrompt(SNOW)).toContain('Implausible shots (off-world): summer barbecue; sunny beach; laboratories')
    expect(worldPrompt(SNOW)).not.toContain('Time of day') // empty fields are left out (no invented daylight)
    expect(worldLine(SNOW)).toContain('off-world: summer barbecue')
    expect(normalizeSceneWorld(undefined, 't')).toBeUndefined()
    expect(normalizeSceneWorld({ mood: '' }, 't')).toBeUndefined()
  })
  it('the story call asks for the world and stores it on the plan (same LLM call)', async () => {
    llm.mockResolvedValueOnce({ title: 'Ready for the Storm', topic: 'home snowstorm preparation', keyPoints: ['a'], world: SNOW_RAW })
    const story = await t2vStoryAgent({ prompt: 'get your home ready for a winter snowstorm', style: 'documentary', durationS: 90 })
    expect(String(llm.mock.calls[0]![0])).toContain('"world"')
    expect(story.world?.implausible).toContain('summer barbecue')
  })
  it('the planner gets the world and returns each line\'s implied situation', async () => {
    llm.mockResolvedValueOnce({
      shots: [{ index: 1, beat: 'detail', intent: 'grill kept outside in the snow', subject: 'grill in a snowy yard', queries: ['snowy grill', 'grill', 'yard'], situation: 'winter at home: the grill stays outside in the snowy yard' }],
    })
    const shots = await t2vScenePlanner({
      story: { title: 'Storm', topic: 'snowstorm', world: SNOW } as never,
      segments: [{ id: 's', narration: 'Never bring an outdoor grill inside for heat.', purpose: 'p', visualMeaning: 'v' }] as never,
      style: 'documentary',
      seed: 'x',
    })
    expect(String(llm.mock.calls[0]![1])).toContain('VIDEO WORLD:\nVideo world: Preparing a home for a winter snowstorm')
    expect(String(llm.mock.calls[0]![0])).toContain('situation')
    expect(shots[0]!.situation).toBe('winter at home: the grill stays outside in the snowy yard')
  })
})

describe('t2v scene world: selection (Gemini contextFit gates every tier)', () => {
  it('snowstorm: the sunny summer BBQ (9/10, off-world) loses to an on-world grill; off-world/dim/1-10 clips never fill', () => {
    const shots = [shot('g', 'Keep generators outdoors, far from windows,'), shot('b', 'and never bring an outdoor grill inside for heat.'), shot('m', 'where everyone can find them if travel becomes difficult.')]
    const { out, tiers } = enforceNoRepeatDeterministic(shots, {
      g: { sceneId: 'g', chosen: null, evaluated: [ev('pylons', { score: 3, lighting: 3, timeOfDay: 'dusk_dawn', contextFit: 3, visible: 'A silhouette of electrical pylons and power lines against a sunset sky.' })] },
      b: {
        sceneId: 'b', chosen: null,
        evaluated: [
          ev('bbq', { score: 9, lighting: 10, contextFit: 2, contextReason: 'sunny summer barbecue contradicts a winter storm', visible: 'A man is outside grilling various meats on a black kettle-style charcoal grill.' }),
          ev('snowgrill', { score: 7, contextFit: 8, visible: 'A covered kettle grill on a snowy patio.' }),
        ],
      },
      m: { sceneId: 'm', chosen: null, evaluated: [ev('lab', { score: 3, lighting: 9, contextFit: 2, visible: 'A female scientist in a lab coat and safety goggles is holding a flask.' })] },
    } as never, { realistic: true, world: SNOW })
    expect(out.b!.chosen!.providerId).toBe('snowgrill')
    expect(tiers.b).toBe('accepted')
    expect(out.g!.chosen).toBeNull() // dim + off-world: no last resort
    expect(out.m!.chosen).toBeNull() // off-world lab: no last resort
  })
  it('sleep: a lamp-lit night bedroom fits a line that never says night; the sunny walk is rejected', () => {
    const { out } = enforceNoRepeatDeterministic([shot('s', "If you can't sleep, get up and do something quiet.")], {
      s: { sceneId: 's', chosen: null, evaluated: [ev('walk', { score: 9, contextFit: 1 }), ev('lamp', { score: 7, timeOfDay: 'night', lighting: 6, contextFit: 9 })] },
    } as never, { realistic: true })
    expect(out.s!.chosen!.providerId).toBe('lamp')
  })
  it('day/night rule stays a safety net without a world; contextFit and lighting apply to last-resort checks', () => {
    const ctx = { realistic: true, nightOk: false, monoOk: false }
    expect(t2vQualityOk({ timeOfDay: 'night', lighting: 8 }, ctx)).toBe(false)
    expect(t2vQualityOk({ timeOfDay: 'night', lighting: 8, contextFit: 8 }, ctx)).toBe(true)
    expect(t2vQualityOk({ timeOfDay: 'day', lighting: 8, contextFit: 4 }, ctx)).toBe(false)
    expect(t2vLitOk({ timeOfDay: 'day', lighting: 8, contextFit: 4 }, ctx)).toBe(false)
    expect(t2vLitOk({ timeOfDay: 'day', lighting: 5, contextFit: 9 }, ctx)).toBe(false)
  })
  it('subject diversity: a third phone loses to an equally good power bank', () => {
    const phone = (id: string, score = 8) => ev(id, { score, subject: 'smartphone', framing: id })
    expect(subjectRepeatPenalty({ subject: 'smartphone screen' }, [{ subject: 'smartphone' }, { subject: 'phone' }])).toBe(3)
    const shots = [shot('a', 'Check the forecast.'), shot('b', 'Watch for advisories.'), shot('c', 'Charge phones and power banks.')]
    const { out } = enforceNoRepeatDeterministic(shots, {
      a: { sceneId: 'a', chosen: null, evaluated: [phone('p1')] },
      b: { sceneId: 'b', chosen: null, evaluated: [phone('p2')] },
      c: { sceneId: 'c', chosen: null, evaluated: [phone('p3', 8), ev('bank', { score: 8, lighting: 7, subject: 'power bank charging cable' })] },
    } as never, { realistic: true })
    expect(out.c!.chosen!.providerId).toBe('bank')
  })
})

describe('t2v scene world: finisher fallback and AI prompts', () => {
  it('never fills a line with a dim, off-world or 0-2 clip; the line rides the previous shot instead', async () => {
    llm.mockResolvedValue({ scores: [] })
    const shots = [shot('a', 'Keep needed medicines close,'), shot('b', 'where everyone can find them if travel becomes difficult.')]
    const { results } = await t2vFinisher({
      workspaceId: 'w',
      doc: { settings: {} } as never,
      run: { style: 'documentary', prompt: 'snowstorm' } as never,
      story: { title: 'Storm', topic: 'snowstorm' } as never,
      segments: [],
      shots,
      results: [
        { sceneId: 'a', chosen: { ...ev('pills', { score: 8, contextFit: 8 }), verdict: 'accepted' }, evaluated: [] },
        { sceneId: 'b', chosen: null, evaluated: [ev('lab', { score: 1, contextFit: 2 }), ev('dim', { score: 6, lighting: 3, contextFit: 8 }), ev('beach', { score: 5, contextFit: 1 })] },
      ] as never,
      candidates: { a: [cand('pills')], b: [cand('lab'), cand('dim'), cand('beach')] },
      world: SNOW,
    })
    expect(results[1]!.outcome).toBe('held')
  })
  it('AI b-roll prompts carry the world and the line situation; no daylight default', async () => {
    llm.mockRejectedValueOnce(new Error('down'))
    const s = shot('x', 'Close curtains.', { subject: 'curtains', situation: 'a snowy evening at home, warm lamp light' })
    const out = await aiBrollPrompts('snowstorm', [s], worldLine(SNOW))
    expect(out.x).toContain('a snowy evening at home, warm lamp light')
    expect(out.x).not.toMatch(/daylight|natural light/i)
    expect(fallbackAiPrompt({ intent: 'i', subject: 's' }, worldLine(SNOW))).toContain('winter, snow')
    llm.mockResolvedValueOnce({ prompts: [] })
    await aiBrollPrompts('snowstorm', [s], worldLine(SNOW))
    expect(String(llm.mock.calls.at(-1)![1])).toContain('VIDEO WORLD: Preparing a home for a winter snowstorm')
  })
  it('sc_15 brief fix: a split piece gets its own brief instead of the sentence subject', () => {
    const briefs = pieceBriefs({ intent: 'closing curtains', subject: 'person closing bedroom curtains', queries: ['closing curtains', 'bedroom curtains', 'dim bedroom'] }, ['Draw the curtains', 'and adjust bedding until the space feels restful'])
    expect(briefs[0]!.subject).toBe('person closing bedroom curtains')
    expect(briefs[1]!.subject).toContain('bedding')
  })
})

describe('t2v scene world: search terms, negation, establishing shots (snow video review)', () => {
  it('appends the world search terms to every stock query once', async () => {
    const { worldQuery } = await import('@/lib/server/t2v/pipeline/t2v-context')
    const w = normalizeSceneWorld({ ...SNOW_RAW, searchTerms: 'winter, snow!' }, 't')!
    expect(w.searchTerms).toBe('winter snow')
    expect(worldQuery('door handle', w)).toBe('door handle winter snow')
    expect(worldQuery('snowy winter house', w)).toBe('snowy winter house snow')
    expect(worldQuery('door handle', SNOW)).toBe('door handle') // no terms given: unchanged
  })
  it('the planner marks negated lines and asks for an establishing opening', async () => {
    llm.mockResolvedValueOnce({ shots: [{ index: 1, intent: 'grill standing outside in the snow', subject: 'grill on snowy patio', queries: ['grill snow', 'patio grill', 'snowy yard'], negated: true }] })
    const shots = await t2vScenePlanner({
      story: { title: 'Storm', topic: 'snowstorm', world: SNOW } as never,
      segments: [{ id: 's', narration: 'Never bring an outdoor grill inside for heat.', purpose: 'p', visualMeaning: 'v' }] as never,
      style: 'documentary',
      seed: 'x',
    })
    expect(shots[0]!.negated).toBe(true)
    expect(String(llm.mock.calls[0]![0])).toMatch(/Shots 1-2 establish the VIDEO WORLD/)
  })
  it('the first shots prefer the clip that establishes the world', () => {
    const { out } = enforceNoRepeatDeterministic([shot('a', 'Before the first flakes arrive, small checks help.')], {
      a: { sceneId: 'a', chosen: null, evaluated: [ev('handle', { score: 8, contextFit: 6, subject: 'door handle' }), ev('snowhouse', { score: 7, contextFit: 10, subject: 'snowy house exterior' })] },
    } as never, { realistic: true, world: SNOW })
    expect(out.a!.chosen!.providerId).toBe('snowhouse')
  })
})
