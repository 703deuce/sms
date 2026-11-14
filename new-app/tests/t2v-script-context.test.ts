import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: vi.fn() }))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn(), logT2vError: vi.fn() }))
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import { applyScriptContext, SCRIPT_CONTEXT_SYSTEM, t2vScriptContext } from '@/lib/server/t2v/pipeline/t2v-script-context'
import { baseSceneId, ideaShots, REIMAGINE_SYSTEM, reimagineOutcomes, reimagineTargets, T2V_REIMAGINE_BATCH, T2V_REIMAGINE_ROUNDS, t2vReimagine, t2vReimagineAll } from '@/lib/server/t2v/pipeline/t2v-reimagine'
import { SPARE_SYSTEM } from '@/lib/server/t2v/pipeline/t2v-no-repeat'

const llm = vi.mocked(t2vLlmJson)
const shot = (sceneId: string, narration: string, extra: Record<string, unknown> = {}) =>
  ({ sceneId, segmentId: 's1', voiceGroup: `vg_${sceneId}`, narration, intent: 'i', queries: ['q1'], subject: 's', needS: 3, ...extra }) as never

describe('script-context pass', () => {
  beforeEach(() => llm.mockReset())
  it('writes a moment, mustRecognise and show ideas for every shot, split pieces included', () => {
    // sc_2a / sc_2b are two pieces of one split sentence: each gets its own moment.
    const shots = [shot('sc_1', 'Choose bedtime and wake times you can keep.'), shot('sc_2a', 'Make the room dark,'), shot('sc_2b', 'quiet, and comfortably cool.')]
    const out = applyScriptContext(shots, {
      videoUnderstanding: 'Practical sleep advice for adults winding down at home in the evening.',
      lines: [
        { lineNo: 1, moment: 'Setting a routine the viewer can keep.', mustRecognise: 'alarm clock', showIdeas: ['alarm clock on bedside table', 'phone alarm screen', 'calendar'] },
        { lineNo: 2, moment: 'Darkening the bedroom for the night.', mustRecognise: 'dim bedroom', showIdeas: ['closing blackout curtains', 'dim bedroom lamp off'] },
        { lineNo: 3, moment: 'A calm, cool room ready for sleep.', mustRecognise: 'cool quiet bedroom', showIdeas: ['fan in a calm bedroom'] },
      ],
    })
    expect(out.videoUnderstanding).toMatch(/sleep advice/)
    expect(out.shots.map((s) => (s as { moment?: string }).moment)).toEqual(['Setting a routine the viewer can keep.', 'Darkening the bedroom for the night.', 'A calm, cool room ready for sleep.'])
    expect(out.shots.map((s) => (s as { subject?: string }).subject)).toEqual(['alarm clock', 'dim bedroom', 'cool quiet bedroom'])
    // Planner queries stay first; the two most direct ideas are added.
    expect((out.shots[0] as { queries: string[] }).queries).toEqual(['q1', 'alarm clock on bedside table', 'phone alarm screen'])
  })
  it('sends the whole numbered script; on failure keeps the planner briefs (non-fatal)', async () => {
    const shots = [shot('a', 'First line.'), shot('b', 'Second line.')]
    llm.mockResolvedValueOnce({ videoUnderstanding: 'x', lines: [{ lineNo: 2, moment: 'm2' }] } as never)
    const ok = await t2vScriptContext({ title: 'T' } as never, shots)
    expect(llm.mock.calls[0]![0]).toBe(SCRIPT_CONTEXT_SYSTEM)
    expect(llm.mock.calls[0]![1]).toContain('1. First line.\n2. Second line.')
    expect((ok.shots[1] as { moment?: string }).moment).toBe('m2')
    llm.mockRejectedValueOnce(new Error('down'))
    const failed = await t2vScriptContext({ title: 'T' } as never, shots)
    expect(failed).toEqual({ videoUnderstanding: '', shots })
  })
})

describe('reimagine (replaces the related round)', () => {
  beforeEach(() => llm.mockReset())
  it('racing: no on-track footage -> new shot ideas (pit crew, crowd), verified under the line itself', async () => {
    const all = [shot('sc_0', 'Race day starts before dawn.'), shot('sc_1', 'Cars scream down the straight at full speed.', { moment: 'The peak of the race.' })]
    llm.mockResolvedValueOnce({
      lines: [
        {
          sceneId: 'sc_1',
          ideas: [
            { intent: 'A pit crew changes tyres in seconds.', mustRecognise: 'pit crew', queries: ['pit stop', 'tyre change', 'race car'] },
            { intent: 'A crowd cheers in the grandstand.', mustRecognise: 'cheering crowd', queries: ['grandstand crowd'] },
            { intent: 'Missing queries are dropped.', mustRecognise: 'x', queries: [] },
          ],
        },
        { sceneId: 'not_a_target', ideas: [{ intent: 'i', mustRecognise: 'm', queries: ['q'] }] },
      ],
    } as never)
    const history = { sc_1: { sceneId: 'sc_1', chosen: null, evaluated: [{ providerId: '9', visible: 'empty asphalt track', score: 2, fitReason: 'no cars, nothing racing' }] } }
    const ideas = await t2vReimagine({ story: { title: 'Race', topic: 'racing', videoUnderstanding: 'A day at a motor race.' } as never, allShots: all, targets: [all[1]!], tried: { sc_1: ['race car', 'racing track'] }, history: history as never })
    const user = String(llm.mock.calls[0]![1])
    expect(llm.mock.calls[0]![0]).toBe(REIMAGINE_SYSTEM)
    expect(user).toContain('What this video is about: A day at a motor race.')
    expect(user).toContain('2. Cars scream down the straight at full speed.')
    expect(user).toContain('no cars, nothing racing') // why it was rejected, in the reviewer's own words
    expect(user).toContain('The peak of the race.')
    expect(Object.keys(ideas)).toEqual(['sc_1'])
    expect(ideas.sc_1!.map((d) => d.mustRecognise)).toEqual(['pit crew', 'cheering crowd'])
    expect(ideas.sc_1![0]!.queries).toEqual(['pit stop', 'tyre change']) // 'race car' was already tried
    const shots = ideaShots(all[1]!, ideas.sc_1!)
    expect(shots.map((s) => (s as { sceneId: string }).sceneId)).toEqual(['sc_1~i0', 'sc_1~i1'])
    expect(shots.every((s) => (s as { narration: string; moment: string }).narration === 'Cars scream down the straight at full speed.' && (s as { moment: string }).moment === 'The peak of the race.')).toBe(true)
    expect(baseSceneId('sc_1~i1')).toBe('sc_1')
    expect(T2V_REIMAGINE_ROUNDS).toBeLessThanOrEqual(2)
  })
})

describe('reimagine per scene (no global line cap)', () => {
  // Braces: a function returned from beforeEach is run as a cleanup hook (the mock itself here).
  beforeEach(() => {
    llm.mockReset()
  })
  const idea = (n: string) => ({ intent: `Another angle ${n}.`, mustRecognise: `thing ${n}`, queries: [`query ${n}`] })
  it('12+ failing scenes ALL get a reimagine round (batched calls, every line included)', async () => {
    const all = Array.from({ length: 23 }, (_, i) => shot(`sc_${i}`, `Line ${i}.`))
    const failing = all.slice(0, 14) // 14 lines with nothing at 5/10+
    // Echo back ideas for whatever lines each call was given.
    llm.mockImplementation((async (_sys: string, user: string) => {
      const lines = JSON.parse(user.split('Lines: ')[1]!) as Array<{ sceneId: string }>
      return { lines: lines.map((l) => ({ sceneId: l.sceneId, ideas: [idea(l.sceneId)] })) }
    }) as never)
    const targets = reimagineTargets(failing, {})
    expect(targets).toHaveLength(14)
    const ideas = await t2vReimagineAll({ story: { title: 'T' } as never, allShots: all, targets, tried: {}, history: {} })
    expect(Object.keys(ideas).sort()).toEqual(failing.map((s) => (s as { sceneId: string }).sceneId).sort())
    expect(llm).toHaveBeenCalledTimes(Math.ceil(14 / T2V_REIMAGINE_BATCH))
    const sent = llm.mock.calls.flatMap((c) => (JSON.parse(String(c[1]).split('Lines: ')[1]!) as Array<{ sceneId: string }>).map((l) => l.sceneId))
    expect(sent.sort()).toEqual(failing.map((s) => (s as { sceneId: string }).sceneId).sort())
  })
  it('a failed batch only costs its own lines this round (no retry); other batches still get ideas', async () => {
    const all = Array.from({ length: 12 }, (_, i) => shot(`sc_${i}`, `Line ${i}.`))
    llm.mockRejectedValueOnce(new Error('down')).mockImplementation((async (_sys: string, user: string) => {
      const lines = JSON.parse(user.split('Lines: ')[1]!) as Array<{ sceneId: string }>
      return { lines: lines.map((l) => ({ sceneId: l.sceneId, ideas: [idea(l.sceneId)] })) }
    }) as never)
    const ideas = await t2vReimagineAll({ story: { title: 'T' } as never, allShots: all, targets: all, tried: {}, history: {} }, 6)
    expect(llm).toHaveBeenCalledTimes(2)
    expect(Object.keys(ideas)).toHaveLength(6)
  })
  it('a scene stops after the per-scene round limit; others keep their own rounds', () => {
    const a = shot('sc_a', 'A.')
    const b = shot('sc_b', 'B.')
    const c = shot('sc_c', 'C.')
    expect(T2V_REIMAGINE_ROUNDS).toBe(2)
    const tries: Record<string, number> = {}
    // Simulate steps: a and b keep failing, c fails only from step 2 on.
    const steps: string[][] = []
    for (let step = 0; step < 6; step++) {
      const failing = step === 0 ? [a, b] : [a, b, c]
      const t = reimagineTargets(failing, tries)
      if (!t.length) break
      steps.push(t.map((s) => (s as { sceneId: string }).sceneId))
      for (const s of t) tries[(s as { sceneId: string }).sceneId] = (tries[(s as { sceneId: string }).sceneId] ?? 0) + 1
    }
    expect(steps).toEqual([['sc_a', 'sc_b'], ['sc_a', 'sc_b', 'sc_c'], ['sc_c']])
    expect(tries).toEqual({ sc_a: 2, sc_b: 2, sc_c: 2 })
    expect(reimagineTargets([a, b, c], tries)).toEqual([])
  })
  it('logs each round per scene: idea text, queries, candidate ids + scores, passed at 5+', () => {
    const pending = {
      sc_1: { round: 1, ideas: [{ intent: 'Pit crew changes tyres.', queries: ['pit stop'] }, { intent: 'Crowd cheers.', queries: ['grandstand crowd'] }] },
      sc_2: { round: 2, ideas: [{ intent: 'Helmet on.', queries: ['driver helmet'] }] },
      sc_3: { round: 1, ideas: [] },
    }
    const results = [
      { sceneId: 'sc_1~i0', chosen: null, evaluated: [{ providerId: '11', score: 3 }, { providerId: '12', score: 6 }] },
      { sceneId: 'sc_1~i1', chosen: null, evaluated: [{ providerId: '13', error: 'download_failed' }] },
      { sceneId: 'sc_2~i0', chosen: null, evaluated: [{ providerId: '21', score: 4 }] },
    ]
    const out = reimagineOutcomes(pending, results as never)
    expect(out).toEqual([
      {
        sceneId: 'sc_1',
        round: 1,
        ideas: [
          { idea: 'sc_1~i0', intent: 'Pit crew changes tyres.', queries: ['pit stop'], candidates: [{ providerId: '11', score: 3 }, { providerId: '12', score: 6 }] },
          { idea: 'sc_1~i1', intent: 'Crowd cheers.', queries: ['grandstand crowd'], candidates: [{ providerId: '13', score: null }] },
        ],
        bestScore: 6,
        passed: true,
      },
      { sceneId: 'sc_2', round: 2, ideas: [{ idea: 'sc_2~i0', intent: 'Helmet on.', queries: ['driver helmet'], candidates: [{ providerId: '21', score: 4 }] }], bestScore: 4, passed: false },
      { sceneId: 'sc_3', round: 1, ideas: [], bestScore: null, passed: false, note: 'no_ideas' },
    ])
  })
  it('the orchestrator has no global line cap on reimagine and gates on the per-scene tries', () => {
    const src = readFileSync(join(__dirname, '../lib/server/t2v/pipeline/t2v-orchestrator.ts'), 'utf8')
    expect(src).not.toMatch(/T2V_REIMAGINE_MAX_SCENES|missing\.slice\(0/)
    expect(src).toMatch(/reimagineTargets\(report\.map\(\(f\) => f\.shot\), gate\)/)
    expect(src).toMatch(/fullPass \?\? \(await enforceNoRepeat/)
    expect(src).not.toMatch(/reimagineRound \?\? 0\) < T2V_REIMAGINE_ROUNDS/)
  })
})

describe('no topic words or season/time/setting rules in prompts and rules', () => {
  const dir = join(__dirname, '../lib/server/t2v/pipeline')
  const files = ['t2v-script-context.ts', 't2v-reimagine.ts', 't2v-query-rewriter.ts', 't2v-scene-planner.ts', 't2v-no-repeat.ts', 't2v-finisher.ts', 't2v-ai-broll.ts', 't2v-orchestrator.ts']
  const prompts = files.flatMap((f) => [...readFileSync(join(dir, f), 'utf8').matchAll(/const ([A-Z_]+) = `([\s\S]*?)`/g)].map((m) => ({ name: `${f}:${m[1]}`, text: m[2]! })))
  const TOPIC = /\b(coffee|beans?|roast(er|ing)?|EVs?|electric vehicles?|dealerships?|charg(ing|er|ers)|battery|snow\w*|winter|blizzard|pylons?|smoke alarm|sleep\w*|bedroom|bedtime|insomnia)\b/i
  it('finds the prompt templates', () => {
    expect(prompts.map((p) => p.name)).toEqual(expect.arrayContaining(['t2v-script-context.ts:SCRIPT_CONTEXT_SYSTEM', 't2v-reimagine.ts:REIMAGINE_SYSTEM', 't2v-query-rewriter.ts:SYSTEM', 't2v-scene-planner.ts:PLANNER_SYSTEM', 't2v-ai-broll.ts:PROMPT_SYSTEM']))
    expect(SPARE_SYSTEM.length).toBeGreaterThan(50)
  })
  it.each(prompts.map((p) => [p.name, p.text] as const))('%s has no topic words', (_name, text) => {
    expect(text.match(TOPIC)).toBeNull()
    // The only worked example is the doc's racing one, in the reimagine prompt.
    if (!_name.endsWith('REIMAGINE_SYSTEM')) expect(text).not.toMatch(/\b(racing|raceway|pit-stop)\b/i)
  })
  it('no word-list or threshold rules for night, colour, brightness or season', () => {
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8')
      expect(src, f).not.toMatch(/NIGHT_WORDS|t2vNightLine|t2vMonoRequested|nightOk|monoOk|MIN_LIGHTING|MIN_LUMA|MIN_SATURATION|HARD context|timeOfDay ===|season ===/)
    }
    expect(SCRIPT_CONTEXT_SYSTEM).not.toMatch(/time of day|weather|season/i)
  })
})
