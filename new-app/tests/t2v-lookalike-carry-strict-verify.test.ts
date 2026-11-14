import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: vi.fn() }))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn(), logT2vError: vi.fn() }))
vi.mock('@/lib/server/t2v/stock-asset', () => ({ ensureT2vStockAsset: async (_w: string, c: { providerId: string }) => ({ id: `asset_${c.providerId}` }) }))
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import { capByDepicts, DEPICTS_CAP, enforceNoRepeat, scoreSparesWithReasons, SPARE_SYSTEM } from '@/lib/server/t2v/pipeline/t2v-no-repeat'
import { REIMAGINE_SYSTEM, trimToBudget } from '@/lib/server/t2v/pipeline/t2v-reimagine'
import { t2vFinisher } from '@/lib/server/t2v/pipeline/t2v-finisher'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Follow-up to #1192 (QA /workspace/test/t2v_1192_snow, VQ t2v-1192-clip-review.md). The live verifier answers
 * are used only as fixtures here, never as prompt text or rules.
 */
const llm = vi.mocked(t2vLlmJson)
type E = Record<string, unknown> & { providerId: string }
const ev = (providerId: string, score: number, o: Partial<E> = {}): E => ({
  provider: 'pixabay', providerId, score, matches: score >= 7, visible: `clip ${providerId}`, seen: `seen ${providerId}`, fitReason: `verify reason ${providerId}`,
  inS: 0, outS: 4, clipS: 10, style: 'live_action', lighting: 7, phash: [], ...o,
})
const shot = (sceneId: string, narration: string, extra: Record<string, unknown> = {}) => ({ sceneId, segmentId: 's1', narration, intent: 'i', queries: ['q'], needS: 3, ...extra }) as never
const res = (sceneId: string, evaluated: E[], chosen: E | null = null) => ({ sceneId, chosen: chosen ? { ...chosen, verdict: 'accepted' } : null, evaluated }) as never
const cand = (id: string) => ({ provider: 'pixabay' as const, providerId: id, previewUrl: 'p', durationS: 20, width: 1920, height: 1080, query: 'q', tags: [], srcUrl: 's', thumbUrl: 't', pageUrl: 'u', author: 'a' })

// Snow sc_14 / sc_19: 44082 (phone plugged into a charger) was banned as a look-alike of 8501 (phone on a
// wireless charger) at 17:07:49Z, then placed on sc_19 by the final pass at 17:09:57Z.
const SNOW = [shot('sc_14', 'and replace weak batteries.'), shot('sc_19', 'Charge phones and power banks,')]
const SNOW_HISTORY = () => ({
  sc_14: res('sc_14', [ev('8501', 6)]),
  sc_19: res('sc_19', [ev('44082', 10), ev('202987', 8)]),
})

describe('bug A: a look-alike ban is carried across the reimagine re-run', () => {
  beforeEach(() => llm.mockReset())
  it('44082: banned in the availability pass, never placed by a later pass whose sequence check misses the pair', async () => {
    // Only the FIRST sequence check flags 44082 as a look-alike of 8501; later checks miss the pair (as live).
    let seqCalls = 0
    llm.mockImplementation((async (sys: string) => (sys === SPARE_SYSTEM ? { scores: [] } : { pairs: seqCalls++ === 0 ? [[0, 1]] : [], sameKind: [] })) as never)
    const first = await enforceNoRepeat(SNOW, SNOW_HISTORY() as never, { realistic: true })
    expect(first.lookalikeBans.map((b) => b.providerId)).toEqual(['44082'])
    expect(first.results.sc_19!.chosen?.providerId).toBe('202987')
    // Root cause: a fresh pass (new model call, no pair flagged) puts 44082 back.
    const fresh = await enforceNoRepeat(SNOW, SNOW_HISTORY() as never, { realistic: true })
    expect(fresh.results.sc_19!.chosen?.providerId).toBe('44082')
    // Fix: the run's bans are carried into the pass.
    const carried = await enforceNoRepeat(SNOW, SNOW_HISTORY() as never, { realistic: true, lookalikeBans: first.lookalikeBans })
    expect(carried.results.sc_19!.chosen?.providerId).toBe('202987')
    expect(carried.lookalikeBans.map((b) => b.providerId)).toEqual(['44082'])
  })
  it('the finisher never places a carried ban either (own fallback or borrowed)', async () => {
    llm.mockImplementation((async (sys: string) => (sys === SPARE_SYSTEM ? { scores: [] } : { pairs: [], sameKind: [] })) as never)
    const shots = [shot('a', 'First line.'), shot('b', 'Second line.')]
    const { results, lookalikeBans } = await t2vFinisher({
      workspaceId: 'w', doc: { settings: {} } as never, run: { style: 'documentary' } as never, story: { title: 't' } as never, segments: [],
      shots: shots as never,
      results: [res('a', [ev('1', 9)], ev('1', 9)), res('b', [ev('44082', 6), ev('2', 5)])] as never,
      candidates: { a: [cand('1')], b: [cand('44082'), cand('2')] },
      lookalikeBans: [{ providerId: '44082', of: '1', sceneId: 'b', source: 'pick_pass', at: 'x' }],
    })
    expect(results[1]!.chosen?.providerId).toBe('2')
    expect(lookalikeBans.map((b) => b.providerId)).toEqual(['44082'])
  })
  it('orchestrator persists the bans on the run and passes them to every pass and the finisher', () => {
    const src = readFileSync(join(__dirname, '../lib/server/t2v/pipeline/t2v-orchestrator.ts'), 'utf8')
    expect(src).toMatch(/lookalikeBans: run\.lookalikeBans \?\? \[\]/)
    expect(src).toMatch(/r\.lookalikeBans = fullPass!\.lookalikeBans/)
    expect(src).toMatch(/lookalikeBans: noRepeat\.lookalikeBans/)
    expect(src).toMatch(/lookalikeBans: fin\.lookalikeBans/)
  })
})

describe('bug B: borrowed clips get the same literal-depiction cap', () => {
  beforeEach(() => llm.mockReset())
  it('the re-check scores a theme match 8 but says depicts no -> capped to 4 and never placed', async () => {
    llm.mockImplementation((async () => ({
      scores: [
        { sceneId: 'sc_13', providerId: '111281', line_shows: 'a bedroom made dark', depicts: 'no', score: 8, reason: 'calm evening mood' },
        { sceneId: 'sc_13', providerId: 'img_1333756', line_shows: 'a bedroom made dark', depicts: 'partly', score: 8, reason: 'a fan in a dim room' },
      ],
    })) as never)
    const shots = [shot('sc_13', 'Make the bedroom dark, quiet, and comfortably cool.')]
    const out = await scoreSparesWithReasons(shots, { sc_13: [ev('111281', 8, { seen: 'Hands turn book pages beside a lit candle.' }), ev('img_1333756', 8)] } as never, {})
    expect(out.scores.sc_13).toEqual({ '111281': 4, img_1333756: 6 })
    expect(DEPICTS_CAP).toEqual({ yes: 10, partly: 6, no: 4 })
    expect(capByDepicts(9, undefined)).toBe(9)
  })
  it('F2: a 7+ clip with no reason keeps a reason derived from what it shows (never silently dropped)', async () => {
    llm.mockImplementation((async () => ({ scores: [{ sceneId: 'sc_1', providerId: '9', depicts: 'yes', score: 8 }] })) as never)
    const out = await scoreSparesWithReasons([shot('sc_1', 'A line.')], { sc_1: [ev('9', 8, { seen: 'A kettle boils on a stove.' })] } as never, {})
    expect(out.scores.sc_1!['9']).toBe(8)
    expect(out.reasons.sc_1!['9']).toContain('A kettle boils on a stove.')
  })
  it('the re-check prompt carries the depiction call; no topic words', () => {
    expect(SPARE_SYSTEM).toContain('depicts')
    expect(SPARE_SYSTEM).toContain('line_shows')
    expect(SPARE_SYSTEM).not.toMatch(/bedroom|candle|battery|phone|snow|winter/i)
  })
})

describe('follow-ups', () => {
  it('F1: the run budget trims reimagine candidates in story order', () => {
    const shots = [{ sceneId: 'a~1' }, { sceneId: 'b~1' }, { sceneId: 'c~1' }]
    const found = { 'a~1': [1, 2, 3], 'b~1': [4, 5, 6], 'c~1': [7] }
    const t = trimToBudget(shots, found, 4)
    expect(t.used).toBe(4)
    expect(t.found).toEqual({ 'a~1': [1, 2, 3], 'b~1': [4] })
    expect(t.dropped).toEqual(['c~1'])
    expect(trimToBudget(shots, found, 100).used).toBe(7)
  })
  it('F4: reimagine asks for shots that directly show the line, not ones that imply it', () => {
    expect(REIMAGINE_SYSTEM).toContain('directly SHOW')
    expect(REIMAGINE_SYSTEM).not.toContain('a detail that implies it')
    expect(REIMAGINE_SYSTEM).not.toMatch(/bedroom|candle|battery|snow|winter/i)
  })
  it('F3: an opening line with nothing at the floor rides forward on the first shot that has footage (no title card)', async () => {
    llm.mockReset()
    llm.mockImplementation((async (sys: string) => (sys === SPARE_SYSTEM ? { scores: [] } : { pairs: [], sameKind: [] })) as never)
    const shots = [shot('a', 'Before the first flakes arrive,'), shot('b', 'check the forecast.')]
    const { scenes, results } = await t2vFinisher({
      workspaceId: 'w', doc: { settings: {} } as never, run: { style: 'documentary' } as never, story: { title: 't' } as never, segments: [],
      shots: shots as never,
      results: [res('a', [ev('x', 2)]), res('b', [ev('2', 9)], ev('2', 9))] as never,
      candidates: { a: [cand('x')], b: [cand('2')] },
    })
    expect(scenes).toHaveLength(1)
    expect(scenes[0]!.narration).toBe('Before the first flakes arrive, check the forecast.')
    expect(scenes[0]!.media.providerId).toBe('2')
    expect(results.map((r) => r.pickedBy)).toEqual(['held', 'accepted'])
  })
  it('F5: a finisher placement that looks like a placed shot gives way and is banned for the run', async () => {
    llm.mockReset()
    let seqCalls = 0
    llm.mockImplementation((async (sys: string) => (sys === SPARE_SYSTEM ? { scores: [] } : { pairs: seqCalls++ === 0 ? [[0, 1]] : [], sameKind: [] })) as never)
    const shots = [shot('a', 'First line.'), shot('b', 'Second line.')]
    const { results, lookalikeBans } = await t2vFinisher({
      workspaceId: 'w', doc: { settings: {} } as never, run: { style: 'documentary' } as never, story: { title: 't' } as never, segments: [],
      shots: shots as never,
      results: [res('a', [ev('1', 9)], ev('1', 9)), res('b', [ev('twin', 6), ev('3', 5)])] as never,
      candidates: { a: [cand('1')], b: [cand('twin'), cand('3')] },
    })
    expect(results[0]!.chosen?.providerId).toBe('1') // the pick pass's choice stands
    expect(results[1]!.chosen?.providerId).toBe('3')
    expect(lookalikeBans).toEqual([expect.objectContaining({ providerId: 'twin', of: '1', sceneId: 'b', source: 'finisher' })])
  })
})
