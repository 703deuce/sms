/**
 * Follow-up to #1194: fixed per-line lineShows, the verified playback window (NEW 2), blind-observation fields
 * on picks (NEW 1), and the QA items S1 (11293 stolen), V2 (hold fallback), V3 (incumbents), budgets, sibling
 * bans and the frozen-plan once case. LLM, DB and stock ingest are mocked; no paid calls.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: vi.fn() }))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn(), logT2vError: vi.fn() }))
vi.mock('@/lib/server/db', () => ({ getPrisma: () => ({}) }))
vi.mock('@/lib/server/t2v/stock-asset', () => ({ ensureT2vStockAsset: async (_w: string, c: { providerId: string }) => ({ id: `asset_${c.providerId}` }) }))
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import { t2vFinisher, t2vPlaybackWindow } from '@/lib/server/t2v/pipeline/t2v-finisher'
import {
  borrowedPick, clearlyBetter, enforceNoRepeatDeterministic, lookalikeSiblings, scoreSparesWithReasons, t2vPlayWindowFor, withIncumbentFirst,
} from '@/lib/server/t2v/pipeline/t2v-no-repeat'
import { fairTrim, markIncumbents, mergeBans, stockVerifyUsed, withIncumbents } from '@/lib/server/t2v/pipeline/t2v-orchestrator'
import { reimagineBudget, sceneAllowance, T2V_REIMAGINE_PER_SCENE_ROUND, trimPerScene } from '@/lib/server/t2v/pipeline/t2v-reimagine'
import { fixLineShows, t2vLineShowsOnce } from '@/lib/server/t2v/pipeline/t2v-script-context'

const llm = vi.mocked(t2vLlmJson)
// Random 64-bit hashes (two are within 10 bits with negligible probability).
const hash = () => [Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')]
const ev = (id: string, o: Record<string, unknown> = {}) => ({
  provider: 'pixabay', providerId: id, visible: '', matches: true, score: 8, depicts: 'yes', inS: 0, outS: 4, clipS: 20, style: 'live_action',
  lighting: 7, phash: hash(), verdict: 'accepted', ...o,
}) as never
const cand = (id: string, o: Record<string, unknown> = {}) => ({ provider: 'pixabay' as const, providerId: id, previewUrl: 'p', durationS: 20, width: 1920, height: 1080, query: 'q', tags: [], srcUrl: 's', thumbUrl: 't', pageUrl: 'u', author: 'a', ...o })
const shot = (sceneId: string, narration = '', extra: Record<string, unknown> = {}) => ({ sceneId, segmentId: 's1', narration, intent: 'i', queries: ['q'], subject: 's', needS: 3, voiceGroup: `vg_${sceneId}`, ...extra }) as never
const finish = (shots: unknown[], results: unknown[], candidates: Record<string, unknown[]>) =>
  t2vFinisher({
    workspaceId: 'w', doc: { settings: { captionsEnabled: true } } as never, run: { style: 'documentary', prompt: 'p' } as never,
    story: { title: 'T' } as never, segments: [], shots: shots as never, results: results as never, candidates: candidates as never,
  })

beforeEach(() => llm.mockReset())

describe('NEW 2: the verified window plays unchanged', () => {
  it('srcInMs is the verified inS; a late window is no longer moved by duration - need - 0.3', () => {
    // cafe 2339: verified 6.2-9.8 s of a 35 s clip.
    expect(t2vPlaybackWindow({ inS: 6.2, outS: 9.8 }, 35)).toEqual({ srcInMs: 6200, windowInMs: 6200, windowOutMs: 9800 })
    // Old: min(11, 13 - 2.5 - 0.3) = 10.2 s, i.e. 0.8 s of frames nobody judged. Now the window plays as verified.
    expect(t2vPlaybackWindow({ inS: 11, outS: 13 }, 13).srcInMs).toBe(11000)
    // Only a stored window past the clip's own end is pulled back inside it.
    expect(t2vPlaybackWindow({ inS: 12, outS: 15 }, 13)).toEqual({ srcInMs: 10000, windowInMs: 10000, windowOutMs: 13000 })
  })
  it('the finisher writes the verified window on the placed media (cuts included)', async () => {
    llm.mockResolvedValue({ pairs: [], sameKind: [], scores: [] } as never)
    const shots = [shot('a', 'Lower the lights as night draws near,', { voiceGroup: 'vg_0' }), shot('b', 'and set bright screens aside before bed.', { voiceGroup: 'vg_0' })]
    const results = [
      { sceneId: 'a', chosen: ev('28690', { inS: 2, outS: 5.6 }), evaluated: [ev('28690', { inS: 2, outS: 5.6 })] },
      { sceneId: 'b', chosen: ev('2339', { inS: 6.2, outS: 9.8, clipS: 35 }), evaluated: [ev('2339', { inS: 6.2, outS: 9.8, clipS: 35 })] },
    ]
    const out = await finish(shots, results, { a: [cand('28690')], b: [cand('2339', { durationS: 35 })] })
    const medias = out.scenes.flatMap((s) => [s.media, ...((s as { cuts?: Array<{ media: unknown }> }).cuts ?? []).map((c) => c.media)]) as Array<{ providerId?: string; srcInMs?: number; windowInMs?: number; windowOutMs?: number }>
    const m = medias.find((x) => x.providerId === '2339')!
    expect([m.srcInMs, m.windowInMs, m.windowOutMs]).toEqual([6200, 6200, 9800])
    expect(medias.find((x) => x.providerId === '28690')!.srcInMs).toBe(2000)
  })
  it('the TS play window matches the worker (play_need + centred)', () => {
    expect(t2vPlayWindowFor(7, 9, 35, 3)).toEqual({ inS: 6.2, outS: 9.8 })
    expect(t2vPlayWindowFor(0, 5, 3, 3)).toEqual({ inS: 0, outS: 3 })
  })
  it('a borrowed clip plays the window the re-check picked for ITS line from the observed events', async () => {
    llm.mockResolvedValue({ scores: [{ sceneId: 'b', providerId: '2339', depicts: 'yes', score: 8, reason: 'puts the phone down', in_s: 7, out_s: 9 }] } as never)
    const e = ev('2339', { clipS: 35, inS: 3, outS: 7, blind: true, observation: '[3.0-7.0 s] phone held up\n[7.0-9.0 s] puts the phone down' })
    const out = await scoreSparesWithReasons([shot('b', 'set screens aside', { lineShows: 'a phone put away' })], { b: [e] })
    const sent = String(llm.mock.calls[0]![1])
    expect(sent).toContain('[7.0-9.0 s] puts the phone down')
    expect(out.judgements.b!['2339']).toMatchObject({ inS: 7, outS: 9, depicts: 'yes' })
    const p = borrowedPick(e, 8, 'puts the phone down', out.judgements.b!['2339'], shot('b', 'x', { lineShows: 'a phone put away', needS: 3 }))
    expect([p.inS, p.outS]).toEqual([6.2, 9.8])
    expect(p.observation).toContain('puts the phone down')
  })
})

describe('S1: a clip goes to the line it fits best (snow 11293)', () => {
  it('"Feel for drafts" (5, partly) cannot take 11293 from "seal gaps" (10, yes), which has nothing else', () => {
    const shots = [shot('sh6', 'Feel for drafts around windows and doors,'), shot('sh7', 'and seal gaps with weatherstripping.')]
    const { out } = enforceNoRepeatDeterministic(shots, {
      sh6: { sceneId: 'sh6', chosen: null, evaluated: [ev('11293', { score: 5, depicts: 'partly', matches: false }), ev('900', { score: 5, depicts: 'partly', matches: false })] },
      sh7: { sceneId: 'sh7', chosen: null, evaluated: [ev('11293', { score: 10, depicts: 'yes' })] },
    } as never, { realistic: true })
    expect(out.sh7!.chosen?.providerId).toBe('11293')
    expect(out.sh6!.chosen?.providerId).not.toBe('11293')
  })
})

describe('V3: incumbents', () => {
  it('the previous pick stays unless a challenger is clearly better', () => {
    const inc = ev('1', { score: 8, incumbent: true })
    expect(withIncumbentFirst([ev('2', { score: 9 }), inc] as never[])[0]).toBe(inc)
    expect(clearlyBetter(ev('2', { score: 10 }), inc)).toBe(true)
    expect(clearlyBetter(ev('2', { score: 7, depicts: 'yes' }), ev('1', { score: 9, depicts: 'partly' }))).toBe(true)
    const shots = [shot('a')]
    const run = (challenger: number) =>
      enforceNoRepeatDeterministic(shots, { a: { sceneId: 'a', chosen: null, evaluated: [ev('2', { score: challenger }), ev('1', { score: 8, incumbent: true })] } } as never, { realistic: true }).out.a!.chosen!.providerId
    expect(run(9)).toBe('1')
    expect(run(10)).toBe('2')
  })
  it('prior picks are re-verified first and flagged', () => {
    const prior = { a: { providerId: '1', score: 8, candidate: cand('1') } }
    const found = withIncumbents({ a: [cand('2'), cand('1')] }, { priorPicks: prior, shots: [shot('a')] } as never)
    expect(found.a!.map((c) => c.providerId)).toEqual(['1', '2'])
    const marked = markIncumbents([{ sceneId: 'a', chosen: null, evaluated: [ev('1'), ev('2')] }] as never, prior)
    expect((marked[0]!.evaluated as Array<{ incumbent?: boolean }>).map((e) => Boolean(e.incumbent))).toEqual([true, false])
  })
})

describe('V2: hold fallback', () => {
  it('a below-floor clip of the line is placed when it beats what the held clip shows for this line', async () => {
    llm.mockResolvedValue({ pairs: [], sameKind: [], scores: [{ sceneId: 'b', providerId: '1', depicts: 'no', score: 1, reason: 'unrelated' }] } as never)
    const shots = [shot('a', 'A line.', { voiceGroup: 'vg_0' }), shot('b', 'Its continuation.', { voiceGroup: 'vg_0' })]
    const results = [
      { sceneId: 'a', chosen: ev('1'), evaluated: [ev('1')] },
      { sceneId: 'b', chosen: null, evaluated: [ev('7', { score: 3, depicts: 'partly', matches: false })] },
    ]
    const out = await finish(shots, results, { a: [cand('1')], b: [cand('7')] })
    expect(out.results[1]!.chosen?.providerId).toBe('7')
    expect(out.results[1]!.chosen?.beatsHold).toEqual({ holdScore: 1, holdFrom: 'a' })
  })
  it('the hold is kept when the held clip was not re-checked (never guessed worse)', async () => {
    llm.mockResolvedValue({ pairs: [], sameKind: [], scores: [] } as never)
    const shots = [shot('a', 'A line.', { voiceGroup: 'vg_0' }), shot('b', 'Its continuation.', { voiceGroup: 'vg_0' })]
    const out = await finish(shots, [
      { sceneId: 'a', chosen: ev('1'), evaluated: [ev('1')] },
      { sceneId: 'b', chosen: null, evaluated: [ev('7', { score: 3, depicts: 'partly', matches: false })] },
    ], { a: [cand('1')], b: [cand('7')] })
    expect(out.results[1]!.outcome).toBe('held')
  })
})

describe('budgets', () => {
  it('reimagine budget scales with failing scenes under the ceiling; allowance is shared fairly', () => {
    expect(reimagineBudget(1, 240)).toBe(2 * T2V_REIMAGINE_PER_SCENE_ROUND)
    expect(reimagineBudget(100, 240)).toBe(240)
    const a = sceneAllowance(['x', 'y'], { x: 1 }, 45)
    expect(a.x).toBe(a.y)
    const t = trimPerScene([{ sceneId: 'x~i0' }, { sceneId: 'x~i1' }], { 'x~i0': [1, 2, 3], 'x~i1': [4, 5, 6] }, { x: 4 }, (s) => s.split('~')[0]!)
    expect(t.found).toEqual({ 'x~i0': [1, 2], 'x~i1': [4, 5] })
  })
  it('the stock run cap trims round-robin and counts line checks, not one-off blind describes', () => {
    const t = fairTrim(['a', 'b'], { a: [1, 2, 3], b: [4] }, 3)
    expect(t.found).toEqual({ a: [1, 2], b: [4] })
    expect(t.used).toBe(3)
    expect(stockVerifyUsed({ verifierCalls: 300, recheckCalls: 40, reimagineVerifyUsed: 60, describeCalls: 120 })).toBe(80)
  })
})

describe('sibling bans and ban merging', () => {
  it('a banned look-alike also bans its same-shoot sibling, never the clip it was banned against', () => {
    const all = [
      { providerId: '24122', author: 'W', subject: 'snowy street', framing: 'wide', action: 'snow falls', phash: ['aaaaaaaaaaaaaaaa'] },
      { providerId: '24123', author: 'W', subject: 'snowy street', framing: 'wide', action: 'snow falls', phash: ['0f0f0f0f0f0f0f0f'] },
      { providerId: '24124', author: 'X', subject: 'snowy street', framing: 'wide', action: 'snow falls' },
      { providerId: '1', author: 'W', subject: 'snowy street', framing: 'wide', action: 'snow falls' },
    ]
    expect(lookalikeSiblings({ providerId: '24122', of: '1' }, all)).toEqual(['24123'])
  })
  it('bans from earlier in the tick are merged, never overwritten', () => {
    const b = (id: string) => ({ providerId: id, of: 'x', sceneId: 's', source: 'pick_pass', at: 't' }) as never
    expect(mergeBans([b('1')], [b('2'), b('1')]).map((x: { providerId: string }) => x.providerId)).toEqual(['1', '2'])
  })
})

describe('fixed lineShows', () => {
  it('a frozen plan gets lineShows ONCE (one call), keeps any it had, and falls back to the intent', async () => {
    llm.mockResolvedValue({ lines: [{ lineNo: 2, lineShows: 'a hand sealing a window gap', searches: ['window seal'] }] } as never)
    const shots = [shot('a', 'A.', { lineShows: 'kept as is' }), shot('b', 'B.'), shot('c', 'C.', { intent: 'plan intent' })]
    const once = await t2vLineShowsOnce({ title: 'T' }, shots)
    expect(llm).toHaveBeenCalledTimes(1)
    expect(once.shots.map((s) => s.lineShows)).toEqual(['kept as is', 'a hand sealing a window gap', 'plan intent'])
    expect(once.fallback).toEqual(['c'])
    // Already fixed: nothing changes and fixLineShows never needs a model.
    expect(fixLineShows(once.shots).fallback).toEqual([])
  })
})
