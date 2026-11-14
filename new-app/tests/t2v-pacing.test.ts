import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: vi.fn() }))
import { pacingStats, planPacing, validPieces, type T2vPacingRow } from '@/lib/server/t2v/pipeline/t2v-pacing'
import { toPacingRows } from '@/lib/server/t2v/pipeline/t2v-scene-planner'
import { pacingCheck } from '@/lib/server/t2v/pipeline/t2v-qa'
import { shotLengthsFrom } from '@/lib/server/t2v/pipeline/t2v-orchestrator'

const piece = (text: string, subject = 's') => ({ text, intent: `show ${text}`, queries: [subject], subject })
const LONG = 'Workers move along the steep rows, picking ripe cherries by hand, while baskets slowly fill with red fruit.'
const row = (narration: string, beat: T2vPacingRow['beat'], pieces?: T2vPacingRow['pieces'], segmentId = 's1'): T2vPacingRow => ({
  segmentId, narration, beat, intent: 'i', queries: ['q'], subject: 'subj', ...(pieces ? { pieces } : {}),
})
const COFFEE: T2vPacingRow[] = [
  row('A cup of coffee begins years earlier, among green leaves growing high on a hillside.', 'establishing', undefined, 'a'),
  row('Here, careful tending and patient seasons prepare each small harvest.', 'emotional', undefined, 'a'),
  row(LONG, 'step', [piece('Workers move along the steep rows,'), piece('picking ripe cherries by hand,'), piece('while baskets slowly fill with red fruit.')], 'b'),
  row('The beans are washed, then spread across drying beds in the sun.', 'step', [piece('The beans are washed,'), piece('then spread across drying beds in the sun.')], 'c'),
  row('Sorters remove damaged beans.', 'list', undefined, 'c'),
  row('Sacks are stacked high.', 'list', undefined, 'c'),
  row('Inside the roastery, green beans tumble in a rotating drum as the heat rises.', 'action', [piece('Inside the roastery, green beans tumble'), piece('in a rotating drum as the heat rises.')], 'd'),
  row('Next time you sip, notice the journey held in its aroma and flavor.', 'emotional', undefined, 'e'),
]

describe('t2v pacing', () => {
  it('pieces must reproduce the sentence word for word', () => {
    expect(validPieces(LONG, [piece('Workers move along the steep rows,'), piece('picking ripe cherries by hand, while baskets slowly fill with red fruit.')])).toBeTruthy()
    expect(validPieces(LONG, [piece('Workers move along the rows,'), piece('picking ripe cherries by hand, while baskets slowly fill with red fruit.')])).toBeUndefined()
    expect(validPieces(LONG, [piece('Workers move'), piece('along the steep rows, picking ripe cherries by hand, while baskets slowly fill with red fruit.')])).toBeUndefined()
  })
  it('splits step/action sentences into in-scene cuts on word offsets; long beats stay long', () => {
    const shots = planPacing(COFFEE, { style: 'documentary', seed: 'x1' })
    const step = shots.filter((s) => s.sentence === LONG)
    expect(step.length).toBeGreaterThanOrEqual(2)
    expect(step.every((s) => s.voiceGroup === step[0]!.voiceGroup)).toBe(true)
    expect(step[0]!.wordOffset).toBe(0)
    expect(step[1]!.wordOffset).toBe(step[0]!.narration.split(/\s+/).length)
    expect(step.map((s) => s.narration).join(' ')).toBe(LONG)
    const est = shots.find((s) => s.narration.startsWith('A cup of coffee'))!
    expect(est.needS).toBeGreaterThan(6)
  })
  it('cut patterns differ between videos (seed) and social is punchier than documentary', () => {
    const pattern = (style: 'documentary' | 'social', seed: string) => planPacing(COFFEE, { style, seed }).map((s) => s.needS).join(',')
    const seeds = ['a', 'b', 'c', 'd', 'e', 'f'].map((k) => pattern('documentary', k))
    expect(new Set(seeds).size).toBeGreaterThan(1)
    const count = (style: 'documentary' | 'social') => ['a', 'b', 'c', 'd', 'e', 'f'].reduce((n, k) => n + planPacing(COFFEE, { style, seed: k }).length, 0)
    expect(count('social')).toBeGreaterThanOrEqual(count('documentary'))
  })
  it('planner rows: bad pieces dropped, unknown beat -> detail, specific subject kept', () => {
    const rows = toPacingRows([{ index: 1, segmentId: 's', narration: LONG }], [{ index: 1, beat: 'montage', subject: 'coffee cherries', intent: 'x', queries: ['coffee cherries'], pieces: [{ text: 'nope not the sentence' }, { text: 'also wrong here ok' }] }], 'coffee')
    expect(rows[0]!.beat).toBe('detail')
    expect(rows[0]!.subject).toBe('coffee cherries')
    expect(rows[0]!.pieces).toBeUndefined()
  })
  it('pacing QA fails the metronomic coffee baseline and passes a varied edit', () => {
    const baseline = [5.8, 5.7, 4.0, 7.2, 3.9, 6.6, 4.5, 7.8, 5.1, 5.5, 4.3, 6.1, 4.8, 6.1, 5.7]
    expect(pacingStats(baseline).cv).toBeLessThan(0.3)
    expect(pacingCheck('p', baseline, 'x')!.ok).toBe(false)
    expect(pacingCheck('p', [8.5, 2.6, 3.1, 6.8, 2.2, 9.0, 3.4, 4.9, 2.5, 7.2], 'x')!.ok).toBe(true)
    expect(pacingStats([3, 3.1, 3.05, 3.0, 8]).longestEqualRun).toBe(4)
  })
  it('shot lengths from assembler starts (an end card only excluded when the draft has one)', () => {
    expect(shotLengthsFrom([0, 5000, 7500, 12000], 14000)).toEqual([5000, 2500, 4500, 2000]) // no end card
    expect(shotLengthsFrom([0, 5000, 7500, 12000], 14000, true)).toEqual([5000, 2500, 4500]) // older drafts with one
    expect(shotLengthsFrom(undefined, 1000)).toBeUndefined()
  })
})
