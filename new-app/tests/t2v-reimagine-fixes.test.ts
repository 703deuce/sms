import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: vi.fn() }))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn(), logT2vError: vi.fn() }))
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import { enforceNoRepeat, enforceNoRepeatDeterministic, SPARE_SYSTEM } from '@/lib/server/t2v/pipeline/t2v-no-repeat'
import { fullSentence, REIMAGINE_SYSTEM, reimagineFailing, reimagineTargets, sceneContext, t2vReimagine } from '@/lib/server/t2v/pipeline/t2v-reimagine'
import { aiBrollEnabled } from '@/lib/server/t2v/pipeline/t2v-ai-broll'

/**
 * Fixes from the #1190 reruns (QA /workspace/test/t2v_1190, Video Quality clip review). VQ's reimagined
 * alternatives are used ONLY as test expectations here, never as prompt rules or example lists.
 */
const llm = vi.mocked(t2vLlmJson)
type E = Record<string, unknown> & { providerId: string }
const ev = (providerId: string, score: number, o: Partial<E> = {}): E => ({
  provider: 'pixabay', providerId, score, matches: score >= 7, visible: `clip ${providerId}`, seen: `seen ${providerId}`, fitReason: `verify reason ${providerId}`,
  inS: 0, outS: 4, clipS: 10, style: 'live_action', lighting: 7, phash: [], ...o,
})
const shot = (sceneId: string, narration: string, extra: Record<string, unknown> = {}) => ({ sceneId, narration, intent: 'i', queries: ['q'], needS: 3, ...extra }) as never
const res = (sceneId: string, evaluated: E[], chosen: E | null = null) => ({ sceneId, chosen: chosen ? { ...chosen, verdict: 'accepted' } : null, evaluated }) as never

// Sleep shots 13-16 (sc_14 / sc_15 / sc_16 in QA's report), ids from the run.
const SLEEP = [
  shot('sc_14', 'Draw curtains, reduce noise,', { voiceGroup: 'vg_7', sentence: 'Draw curtains, reduce noise, and adjust bedding so the space feels restful.' }),
  shot('sc_15', 'and adjust bedding so the space feels restful.', { voiceGroup: 'vg_7', sentence: 'Draw curtains, reduce noise, and adjust bedding so the space feels restful.' }),
  shot('sc_16', 'Keep the bed ready for sleep, with fewer bright lights and interruptions nearby.', { voiceGroup: 'vg_8' }),
]

describe('fix 1: reimagine also fires when a line\'s good clips are used elsewhere or banned as look-alikes', () => {
  it('sleep sc_15: 363408 (9) used by sc_14 and 42966 (9) banned -> failing, gets its own round', () => {
    const history = {
      sc_14: res('sc_14', [ev('363408', 10)]),
      sc_15: res('sc_15', [ev('363408', 9), ev('42966', 9)]),
      sc_16: res('sc_16', [ev('900', 8)]),
    }
    const pass = {
      results: { sc_14: res('sc_14', [], ev('363408', 10)), sc_15: res('sc_15', []), sc_16: res('sc_16', [], ev('900', 8)) } as never,
      tiers: { sc_14: 'accepted', sc_16: 'accepted' },
      banned: { sc_14: ['42966'], sc_15: ['42966'], sc_16: ['42966'] },
    }
    const failing = reimagineFailing(SLEEP, history as never, pass)
    expect(failing.map((f) => (f.shot as { sceneId: string }).sceneId)).toEqual(['sc_15'])
    expect(failing[0]!.ownAt5).toBe(2)
    expect(failing[0]!.blocked).toEqual([
      { providerId: '363408', score: 9, reason: 'used_by:sc_14' },
      { providerId: '42966', score: 9, reason: 'banned_by_sequence_check' },
    ])
    // Same bounded per-scene limit: two rounds, then the finisher may extend.
    expect(reimagineTargets(failing.map((f) => f.shot), {})).toHaveLength(1)
    expect(reimagineTargets(failing.map((f) => f.shot), { sc_15: 2 })).toHaveLength(0)
  })
  it('the availability check is the full pass: a look-alike ban from the sequence check makes the line fail', async () => {
    const shots = [shot('sc_1', 'Choose bedtime and wake times you can keep.'), shot('sc_3', 'Let your morning alarm')]
    const history = {
      sc_1: res('sc_1', [ev('15629', 10, { phash: [] })], ev('15629', 10)),
      sc_3: res('sc_3', [ev('15629', 10), ev('21223', 9)]),
    }
    llm.mockReset()
    llm.mockImplementation((async (sys: string) => {
      if (sys === SPARE_SYSTEM) return { scores: [] }
      return { pairs: [[0, 1]], sameKind: [] } // 21223 looks like 15629
    }) as never)
    const pass = await enforceNoRepeat(shots, history as never, { realistic: true })
    expect(pass.results.sc_3!.chosen).toBeNull()
    const failing = reimagineFailing(shots, history as never, pass)
    expect(failing.map((f) => (f.shot as { sceneId: string }).sceneId)).toEqual(['sc_3'])
    expect(failing[0]!.blocked.map((b) => b.reason).sort()).toEqual(['banned_by_sequence_check', 'used_by:sc_1'])
  })
})

describe('fix 3: a look-alike ban holds for every line; fitReason always comes from this line', () => {
  beforeEach(() => {
    llm.mockReset()
  })
  it('sleep sh16: 42966 banned as a look-alike of 363408 is never placed on the next line either', async () => {
    const history = {
      sc_14: res('sc_14', [ev('363408', 10)], ev('363408', 10)),
      sc_15: res('sc_15', [ev('42966', 9)], ev('42966', 9)),
      sc_16: res('sc_16', [ev('42966', 6), ev('777', 5)]),
    }
    let checks = 0
    llm.mockImplementation((async (sys: string) => {
      if (sys === SPARE_SYSTEM) return { scores: [] }
      checks++
      return checks === 1 ? { pairs: [[0, 1]], sameKind: [] } : { pairs: [], sameKind: [] }
    }) as never)
    const pass = await enforceNoRepeat(SLEEP, history as never, { realistic: true })
    expect(pass.banned.sc_15).toContain('42966')
    expect(pass.banned.sc_16).toContain('42966')
    expect(pass.results.sc_16!.chosen?.providerId).toBe('777')
    expect(Object.values(pass.results).filter((r) => r.chosen?.providerId === '42966')).toHaveLength(0)
  })
  it('a spare carries the re-check reason for ITS line, never the reason from the line it was verified for', () => {
    const shots = [shot('a', 'Line A.'), shot('b', 'Line B.')]
    const history = { a: res('a', [ev('1', 9), ev('2', 8)], ev('1', 9)), b: res('b', [ev('3', 2)]) }
    const withReason = enforceNoRepeatDeterministic(shots, history as never, { realistic: true, spareScores: { b: { '2': 6 } }, spareReasons: { b: { '2': 'shows a person doing what line B says' } } })
    const c = withReason.out.b!.chosen!
    expect(c.providerId).toBe('2')
    expect(c.fitReason).toBe('shows a person doing what line B says')
    expect(c.fitReasonFrom).toBe('line_recheck')
    expect(c.reviewedForOtherLine).toBe(8)
    // No reason from the re-check for this line -> not placed.
    const noReason = enforceNoRepeatDeterministic(shots, history as never, { realistic: true, spareScores: { b: { '2': 6 } }, spareReasons: {} })
    expect(noReason.out.b!.chosen).toBeNull()
  })
})

describe('fix 4: every placed pick keeps the reviewer\'s fit_reason and seen (photos included)', () => {
  it('photo tier and re-picked accepted clips keep fitReason + seen', () => {
    const shots = [shot('sc_4', 'Keep needed medicines close,'), shot('sc_18', 'and bring shovels and ice melt within reach.')]
    const history = {
      sc_4: res('sc_4', [ev('img_8287535', 10, { kind: 'photo', fitReason: 'the medicines the line names', seen: 'a pill bottle and pills' })]),
      // Worker chose a clip that the web pass cannot use (style); the accepted tier re-picks from evaluated.
      sc_18: res('sc_18', [ev('157204', 8, { fitReason: 'a person shovelling snow', seen: 'a gloved person shovels snow' })], ev('999', 9, { style: 'animation' })),
    }
    const { out, tiers } = enforceNoRepeatDeterministic(shots, history as never, { realistic: true })
    expect(tiers.sc_4).toBe('photo')
    expect(out.sc_4!.chosen).toMatchObject({ fitReason: 'the medicines the line names', seen: 'a pill bottle and pills', fitReasonFrom: 'verify' })
    expect(out.sc_18!.chosen).toMatchObject({ providerId: '157204', fitReason: 'a person shovelling snow', seen: 'a gloved person shovels snow' })
  })
})

describe('split scenes: verifier and reimagine read the full sentence plus neighbours', () => {
  beforeEach(() => {
    llm.mockReset()
  })
  it('sleep "and adjust bedding": the verify context carries the whole sentence and the neighbouring lines', () => {
    const ctx = sceneContext(SLEEP, 'sc_15~i1')
    expect(ctx).toEqual({
      lineNo: 2,
      sentence: 'Draw curtains, reduce noise, and adjust bedding so the space feels restful.',
      prevNarration: 'Draw curtains, reduce noise,',
      nextNarration: 'Keep the bed ready for sleep, with fewer bright lights and interruptions nearby.',
    })
    // Without the planner's sentence, the voice group's pieces are joined.
    const noSentence = [shot('x1', 'If sleep does not come,', { voiceGroup: 'g' }), shot('x2', 'step out of bed for a little while.', { voiceGroup: 'g' })]
    expect(fullSentence(noSentence, 1)).toBe('If sleep does not come, step out of bed for a little while.')
  })
  it('sleep "step out of bed": the reimagine input carries the full sentence and neighbours (VQ: "feet swinging out of bed in a dim bedroom" is a test expectation only)', async () => {
    const all = [
      shot('sc_16', 'Keep the bed ready for sleep.'),
      shot('sc_17', 'If sleep does not come,', { voiceGroup: 'g9' }),
      shot('sc_18', 'step out of bed for a little while.', { voiceGroup: 'g9', moment: 'Getting up quietly at night when sleep will not come.' }),
      shot('sc_19', 'Sit quietly and choose a restful activity, keeping lights low.'),
    ]
    llm.mockResolvedValueOnce({ lines: [{ sceneId: 'sc_18', ideas: [{ intent: 'Feet swing out of bed onto the floor in a dim bedroom.', mustRecognise: 'getting out of bed', queries: ['getting out of bed'] }] }] } as never)
    const history = { sc_18: { sceneId: 'sc_18', chosen: null, evaluated: [{ providerId: '5', seen: 'An older woman in a summer dress on a sunny pergola bench', score: 2, fitReason: 'outdoors, not getting out of bed' }] } }
    const ideas = await t2vReimagine({ story: { title: 'Sleep' } as never, allShots: all, targets: [all[2]!], tried: {}, history: history as never })
    const lines = JSON.parse(String(llm.mock.calls[0]![1]).split('Lines: ')[1]!)
    expect(lines[0]).toMatchObject({
      sceneId: 'sc_18',
      line: 'step out of bed for a little while.',
      fullSentence: 'If sleep does not come, step out of bed for a little while.',
      previousLine: 'If sleep does not come,',
      nextLine: 'Sit quietly and choose a restful activity, keeping lights low.',
      moment: 'Getting up quietly at night when sleep will not come.',
    })
    expect(lines[0].rejected[0].showed).toMatch(/pergola/) // what the reviewer literally saw (seen)
    expect(ideas.sc_18![0]!.intent).toMatch(/out of bed/)
    // VQ's alternatives are not in the prompt.
    expect(REIMAGINE_SYSTEM).not.toMatch(/bed|feet|pergola|curtain/i)
  })
})

describe('fix 5 (web side): an explicit aiBroll=false wins over the global test flag', () => {
  const old = process.env.T2V_AI_BROLL_TEST
  afterEach(() => {
    process.env.T2V_AI_BROLL_TEST = old
  })
  it('aiBroll false -> off even with T2V_AI_BROLL_TEST=1', () => {
    process.env.T2V_AI_BROLL_TEST = '1'
    expect(aiBrollEnabled({ aiBroll: false })).toBe(false)
    expect(aiBrollEnabled({})).toBe(true)
    process.env.T2V_AI_BROLL_TEST = ''
    expect(aiBrollEnabled({ aiBroll: true })).toBe(true)
    expect(aiBrollEnabled({})).toBe(false)
  })
})
