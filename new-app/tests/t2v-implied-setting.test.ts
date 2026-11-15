import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: vi.fn() }))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn(), logT2vError: vi.fn() }))
import { t2vLlmJson } from '@/lib/server/t2v/pipeline/t2v-llm'
import { capBySetting, normSettingFit, parseSetting, SETTING_CAP, settingText } from '@/lib/server/t2v/pipeline/t2v-setting'
import { applyScriptContext, applySettingsOnly, SCRIPT_CONTEXT_SYSTEM } from '@/lib/server/t2v/pipeline/t2v-script-context'
import { borrowedPick, FILLER_MIN_SCORE, scoreSparesWithReasons, SPARE_SYSTEM } from '@/lib/server/t2v/pipeline/t2v-no-repeat'
import { aiBrollPrompts, fallbackAiPrompt } from '@/lib/server/t2v/pipeline/t2v-ai-broll'
import { ideaShots } from '@/lib/server/t2v/pipeline/t2v-reimagine'

/**
 * Whole-video context for stock picks (Rick, Nov 15): "if you can't sleep, get out of bed and do a quiet
 * activity" got a daytime walk in the woods. It literally matches "activity" but contradicts the video's
 * night / indoor / calm setting. The setting is the model's reading of the topic and the neighbouring lines.
 */
const llm = vi.mocked(t2vLlmJson)
const NIGHT = { timeOfDay: 'night', place: 'indoor', where: 'bedroom', mood: 'calm, quiet, dim' }
const shot = (sceneId: string, narration: string, extra: Record<string, unknown> = {}) =>
  ({ sceneId, segmentId: 's1', narration, intent: 'i', queries: ['q1'], subject: 's', needS: 3, ...extra }) as never

describe('implied setting helpers', () => {
  it('parses the model setting and writes one prompt line', () => {
    expect(parseSetting({ timeOfDay: 'Night', place: 'indoors', where: 'bedroom', mood: 'calm' })).toEqual({ timeOfDay: 'night', place: 'indoor', where: 'bedroom', mood: 'calm' })
    expect(parseSetting({ timeOfDay: 'at dusk', place: 'outside' })).toMatchObject({ timeOfDay: 'evening', place: 'outdoor' })
    expect(parseSetting({ timeOfDay: 'any', place: 'any' })).toBeUndefined()
    expect(parseSetting(null)).toBeUndefined()
    expect(settingText(NIGHT)).toBe('time of day: night; place: indoor (bedroom); mood: calm, quiet, dim')
    expect(settingText({ timeOfDay: 'any', place: 'any', where: 'kitchen', mood: '' })).toBe('place: kitchen')
    expect(settingText(undefined)).toBe('')
  })
  it('contradicts caps below the filler floor; other answers never cap', () => {
    expect(SETTING_CAP).toBeLessThan(FILLER_MIN_SCORE)
    expect(normSettingFit('Contradicts.')).toBe('contradicts')
    expect(normSettingFit('fits')).toBe('fits')
    expect(normSettingFit(undefined)).toBe('neutral')
    expect(capBySetting(9, 'contradicts')).toBe(4)
    expect(capBySetting(9, 'neutral')).toBe(9)
    expect(capBySetting(3, 'contradicts')).toBe(3)
  })
  it('worker and web use the same cap', () => {
    const py = readFileSync(join(__dirname, '../../worker/clips_worker/t2v/verify_stock.py'), 'utf8')
    expect(py).toMatch(new RegExp(`^SETTING_CAP = ${SETTING_CAP}$`, 'm'))
  })
})

describe('script-context pass writes the implied setting', () => {
  it('asks for a setting inferred from the topic and the neighbouring lines, used by lineShows and searches', () => {
    expect(SCRIPT_CONTEXT_SYSTEM).toMatch(/"setting": \{"timeOfDay"/)
    expect(SCRIPT_CONTEXT_SYSTEM).toMatch(/not only from this line's own words/)
    expect(SCRIPT_CONTEXT_SYSTEM).toMatch(/generic word in a line[\s\S]*read through the video/)
    expect(SCRIPT_CONTEXT_SYSTEM).toMatch(/lineShows always fits the line's setting/)
    expect(SCRIPT_CONTEXT_SYSTEM).toMatch(/no query may describe a version\s+that contradicts the line's setting/)
  })
  it('stores the setting per shot (idea shots inherit it)', () => {
    const out = applyScriptContext([shot('sc_1', 'Lying awake makes it worse.'), shot('sc_2', "If you can't sleep, get out of bed and do a quiet activity.")], {
      videoUnderstanding: 'Advice for people who cannot fall asleep at night.',
      lines: [
        { lineNo: 1, moment: 'Awake in bed at night.', lineShows: 'a person lying awake in bed at night', setting: NIGHT },
        { lineNo: 2, moment: 'Leaving bed to do something calm.', lineShows: 'a person reading a book by lamp light at night', setting: { ...NIGHT, where: 'living room' }, searches: ['reading lamp night', 'reading book armchair'] },
      ],
    })
    const s2 = out.shots[1] as { setting?: unknown; queries: string[] }
    expect(s2.setting).toEqual({ ...NIGHT, where: 'living room' })
    expect(s2.queries.slice(0, 2)).toEqual(['reading lamp night', 'reading book armchair'])
    const idea = ideaShots(out.shots[1]!, [{ intent: 'a person knitting under a lamp', mustRecognise: 'knitting', queries: ['knitting lamp'] }])[0] as { setting?: unknown }
    expect(idea.setting).toEqual({ ...NIGHT, where: 'living room' })
  })
  it('frozen plans: only missing settings are filled', () => {
    const shots = [shot('sc_1', 'a', { setting: { timeOfDay: 'day', place: 'outdoor', where: 'park', mood: '' } }), shot('sc_2', 'b')]
    const out = applySettingsOnly(shots, [{ lineNo: 1, setting: NIGHT }, { lineNo: 2, setting: NIGHT }])
    expect(out.fromModel).toBe(1)
    expect((out.shots[0] as { setting: { where: string } }).setting.where).toBe('park')
    expect((out.shots[1] as { setting: unknown }).setting).toEqual(NIGHT)
  })
})

describe('cross-line, spare, hold and last-resort re-checks use the same setting check', () => {
  beforeEach(() => llm.mockReset())
  const woods = { providerId: '111', score: 8, subject: 'hiker', seen: 'a person walking on a forest trail in bright daylight', framing: 'wide', clipSetting: 'outdoor forest trail, daytime', inS: 0, outS: 5, clipS: 9 }
  const reader = { providerId: '222', score: 7, subject: 'reader', seen: 'a woman reading under a lamp', framing: 'medium', clipSetting: 'indoor living room at night', inS: 0, outS: 5, clipS: 9 }
  it('sends the line setting and the clip setting; contradicts is capped at 4 and recorded', async () => {
    llm.mockResolvedValue({ scores: [
      { sceneId: 'sc_2', providerId: '111', depicts: 'yes', settingFit: 'contradicts', score: 8, reason: 'a daytime woods walk, the moment is indoors at night' },
      { sceneId: 'sc_2', providerId: '222', depicts: 'yes', settingFit: 'fits', score: 8, reason: 'calm reading at night' },
    ] })
    const shots = [shot('sc_1', 'Lying awake makes it worse.', { setting: NIGHT }), shot('sc_2', 'get out of bed and do a quiet activity.', { setting: NIGHT, lineShows: 'a calm activity at night' })]
    const r = await scoreSparesWithReasons(shots, { sc_2: [woods, reader] as never }, { script: '1. a\n2. b', videoUnderstanding: 'sleep help' })
    expect(r.scores.sc_2).toEqual({ '111': 4, '222': 8 })
    expect(r.judgements.sc_2!['111']!.settingFit).toBe('contradicts')
    const user = String(llm.mock.calls[0]![1])
    expect(user).toContain('"setting":"time of day: night; place: indoor (bedroom); mood: calm, quiet, dim"')
    expect(user).toContain('"clipSetting":"outdoor forest trail, daytime"')
    expect(SPARE_SYSTEM).toMatch(/even if the literal subject\s+or action matches/)
    // Placed borrowed picks carry the placed line's setting judgement.
    const pick = borrowedPick(reader as never, 8, 'calm reading at night', r.judgements.sc_2!['222'], shots[1]!)
    expect(pick.settingFit).toBe('fits')
  })
  it('idea shots are re-checked against their line setting', async () => {
    llm.mockResolvedValue({ scores: [] })
    const base = shot('sc_2', 'do a quiet activity.', { setting: NIGHT })
    const idea = ideaShots(base, [{ intent: 'reading', mustRecognise: 'book', queries: ['book'] }])[0]!
    await scoreSparesWithReasons([base, idea], { [idea.sceneId]: [reader] as never })
    expect(String(llm.mock.calls[0]![1])).toContain('time of day: night')
  })
  it('the hold fallback never places a setting-contradicting clip', () => {
    const src = readFileSync(join(__dirname, '../lib/server/t2v/pipeline/t2v-finisher.ts'), 'utf8')
    expect(src).toMatch(/HOLD_COMPARE_MIN && e\.settingFit !== 'contradicts'/)
    expect(src).toMatch(/lineJudgements\[shot\.sceneId\]\?\.\[e\.providerId\]\?\.settingFit !== 'contradicts'/)
  })
})

describe('AI B-roll prompts include the implied setting', () => {
  beforeEach(() => llm.mockReset())
  it('template prompt and prompt writer input', async () => {
    const s = shot('sc_2', 'do a quiet activity.', { setting: NIGHT, intent: 'a person reading a book', subject: 'book' })
    expect(fallbackAiPrompt(s)).toContain('Setting: time of day: night; place: indoor (bedroom); mood: calm, quiet, dim.')
    llm.mockResolvedValue({ prompts: [] })
    await aiBrollPrompts('better sleep', [s])
    expect(String(llm.mock.calls[0]![1])).toContain('"setting":"time of day: night')
  })
})
