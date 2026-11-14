import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: vi.fn() }))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn(), logT2vError: vi.fn() }))
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import { depictsRank, enforceNoRepeat, enforceNoRepeatDeterministic, SPARE_SYSTEM } from '@/lib/server/t2v/pipeline/t2v-no-repeat'
import { mergeVerifyResults } from '@/lib/server/t2v/pipeline/t2v-orchestrator'
import { ideaShots } from '@/lib/server/t2v/pipeline/t2v-reimagine'

/** #1194 round 2, from VQ's watched review of the #1192 sleep rerun (t2v_cf976bf4). Fixtures only. */
vi.mock('@/lib/server/db', () => ({ getPrisma: () => ({}) }))
const llm = vi.mocked(t2vLlmJson)
type E = Record<string, unknown> & { providerId: string }
const ev = (providerId: string, score: number, o: Partial<E> = {}): E => ({
  provider: 'pixabay', providerId, score, matches: score >= 7, visible: `clip ${providerId}`, seen: `seen ${providerId}`, fitReason: `r ${providerId}`,
  inS: 0, outS: 4, clipS: 10, style: 'live_action', lighting: 7, phash: [], ...o,
})
const shot = (sceneId: string, narration: string) => ({ sceneId, narration, intent: 'i', queries: ['q'], needS: 3 }) as never
const res = (sceneId: string, evaluated: E[], chosen: E | null = null) => ({ sceneId, chosen: chosen ? { ...chosen, verdict: 'accepted' } : null, evaluated }) as never

describe('item 1: depiction ranks before score, so a literal reimagine pick beats an earlier stretched one', () => {
  it('order: yes > not judged > partly > no', () => {
    expect([depictsRank({ depicts: 'yes' }), depictsRank({}), depictsRank({ depicts: 'partly' }), depictsRank({ depicts: 'no' })]).toEqual([3, 2, 1, 0])
  })
  it('sleep sh13: the carried candlelit-reading pick (9, judged before depicts) yields to the reimagined fan (8, yes)', () => {
    const shots = [shot('sc_13', 'Make the bedroom dark, quiet, and comfortably cool.')]
    // Reimagine results merge without a pick (chosen: null), so the earlier pick is still carried.
    const history = mergeVerifyResults({ sc_13: res('sc_13', [ev('111281', 9)], ev('111281', 9)) }, [res('sc_13', [ev('1028', 8, { depicts: 'yes' })])])
    expect(history.sc_13!.chosen?.providerId).toBe('111281')
    const d = enforceNoRepeatDeterministic(shots, history as never, { realistic: true })
    expect(d.out.sc_13!.chosen?.providerId).toBe('1028')
  })
  it('sleep sh13: a thermostat photo that shows the line (10, yes) beats a stretched video (8, partly-capped 6)', () => {
    const shots = [shot('sc_13', 'Make the bedroom dark, quiet, and comfortably cool.')]
    const history = { sc_13: res('sc_13', [ev('111281', 6, { depicts: 'partly', matches: false }), ev('img_1687928', 10, { kind: 'photo', depicts: 'yes' })]) }
    const d = enforceNoRepeatDeterministic(shots, history as never, { realistic: true })
    expect(d.out.sc_13!.chosen?.providerId).toBe('img_1687928')
    expect(d.tiers.sc_13).toBe('photo')
  })
  it('a video still wins a tie in depiction (motion first)', () => {
    const shots = [shot('sc_17', 'If sleep does not come,')]
    const history = { sc_17: res('sc_17', [ev('img_1', 10, { kind: 'photo', depicts: 'yes' }), ev('151295', 8, { depicts: 'yes' })]) }
    expect(enforceNoRepeatDeterministic(shots, history as never, { realistic: true }).out.sc_17!.chosen?.providerId).toBe('151295')
  })
  it('mergeVerifyResults keeps the more literal worker pick across rounds', () => {
    const h = mergeVerifyResults({ a: res('a', [ev('1', 9)], ev('1', 9)) }, [res('a', [ev('2', 8, { depicts: 'yes' })], ev('2', 8, { depicts: 'yes' }))])
    expect(h.a!.chosen?.providerId).toBe('2')
  })
})

describe('item 7: sleep sh6 lost its walker to a look-alike ban; with capped stretches it keeps it', () => {
  beforeEach(() => llm.mockReset())
  it('146135 (walk, 10) vs 3171 (garden, 9): the line whose next option is weaker keeps its clip', async () => {
    const shots = [shot('sc_5', 'During the day, step outside into natural light.'), shot('sc_6', 'Take a gentle walk,')]
    const history = (cyclists: E) => ({
      sc_5: res('sc_5', [ev('3171', 9, { depicts: 'yes' }), ev('500', 8, { depicts: 'yes' })]),
      sc_6: res('sc_6', [ev('146135', 10, { depicts: 'yes' }), cyclists]),
    })
    let seq = 0
    const once = () => {
      seq = 0
      llm.mockImplementation((async (sys: string) => (sys === SPARE_SYSTEM ? { scores: [] } : { pairs: seq++ === 0 ? [[0, 1]] : [], sameKind: [] })) as never)
    }
    once()
    // Live run: the cyclists were a 9 for "take a gentle walk", so sc_6 looked like the line with the backup.
    const live = await enforceNoRepeat(shots, history(ev('171960', 9)) as never, { realistic: true })
    expect(live.results.sc_6!.chosen?.providerId).toBe('171960')
    // With the depiction cap (cyclists: partly -> 6) sc_5 gives way instead and the walker stays.
    once()
    const now = await enforceNoRepeat(shots, history(ev('171960', 6, { depicts: 'partly', matches: false })) as never, { realistic: true })
    expect(now.results.sc_6!.chosen?.providerId).toBe('146135')
    expect(now.results.sc_5!.chosen?.providerId).toBe('500')
  })
})

describe('item 3/5: reimagine idea and static clips', () => {
  it('idea shots carry the intended shot for the checker', () => {
    const s = ideaShots({ sceneId: 'sc_18', narration: 'step out of bed for a little while.', intent: 'x', queries: [], needS: 3 } as never, [
      { intent: 'Show slippers set beside the bed as a person rises', mustRecognise: 'slippers by bed', queries: ['slippers bed'] },
    ])
    expect(s[0]).toMatchObject({ sceneId: 'sc_18~i0', idea: 'Show slippers set beside the bed as a person rises' })
  })
  it('a static video counts as a still for the max-2-stills rule', () => {
    const shots = [shot('a', 'A.'), shot('b', 'B.'), shot('c', 'C.')]
    const history = {
      a: res('a', [ev('p1', 9, { kind: 'photo' })]),
      b: res('b', [ev('p2', 9, { kind: 'photo' })]),
      c: res('c', [ev('frozen', 6, { static: true, matches: false }), ev('moving', 5)]),
    }
    const d = enforceNoRepeatDeterministic(shots, history as never, { realistic: true })
    const picks = ['a', 'b', 'c'].map((k) => d.out[k]!.chosen)
    // Never three stills in a row: the frozen clip is one of them.
    expect(picks.every((p) => p && (p.kind === 'photo' || p.static))).toBe(false)
    expect(picks.map((p) => p?.providerId)).not.toEqual(['p1', 'p2', 'frozen'])
  })
})
