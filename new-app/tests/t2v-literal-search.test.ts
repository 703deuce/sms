import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: vi.fn() }))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn(), logT2vError: vi.fn() }))
vi.mock('@/lib/server/ai/pexels', () => ({ pexelsConfigured: () => false }))
vi.mock('@/lib/server/t2v/stock-match', () => ({ searchT2vStock: vi.fn() }))
import { interleaveQueries, queryRewrites, queryWords, t2vFootageAgent, tagOverlap } from '@/lib/server/t2v/pipeline/t2v-footage-agent'
import { applyScriptContext, SCRIPT_CONTEXT_SYSTEM } from '@/lib/server/t2v/pipeline/t2v-script-context'
import { REIMAGINE_SYSTEM } from '@/lib/server/t2v/pipeline/t2v-reimagine'

/**
 * Diagnosis cases (t2v-search-diagnosis.md): real ids/tags from the #1192 sleep/snow drafts and free Pixabay probes.
 * The search went after abstract phrases and one query filled all 8 slots; the fix searches for what a viewer
 * should literally see (script-context lineShows -> short keyword searches, first) and gives every query a turn.
 */
const shot = (sceneId: string, narration: string, queries: string[]) =>
  ({ sceneId, segmentId: 's1', voiceGroup: `vg_${sceneId}`, narration, intent: 'i', queries, subject: 's', needS: 3 }) as never
type R = { id: string; overlap: number; words: number; qi: number; rank: number }
const hit = (q: string, qi: number, rank: number, id: string, tags: string): R => {
  const w = queryWords(q)
  return { id, overlap: tagOverlap(w, tags.split(', ')), words: w.length, qi, rank }
}

describe('literal searches from lineShows (script-context pass)', () => {
  it('sleep sh12: lineShows + short literal searches go first; planner queries follow; long ideas are not searched', () => {
    const out = applyScriptContext([shot('sc_12', 'Charge your phone across the room, not beside your pillow.', ['phone charging', 'smartphone night', 'bedside table'])], {
      videoUnderstanding: 'Practical advice',
      lines: [
        {
          lineNo: 1,
          moment: 'Moving the phone away from the bed.',
          lineShows: 'A phone charging on a surface away from the bed.',
          mustRecognise: 'phone charging',
          showIdeas: ['a phone plugged in on a dresser across the room', 'hand plugging in a phone charger'],
          searches: ['Charging phone', 'phone on dresser', 'mobile charging', 'phone charger', 'a fifth one'],
        },
      ],
    })
    const s = out.shots[0] as { queries: string[]; lineShows?: string }
    expect(s.lineShows).toBe('A phone charging on a surface away from the bed.')
    expect(s.queries).toEqual(['charging phone', 'phone on dresser', 'mobile charging', 'phone charger', 'phone charging', 'smartphone night', 'bedside table'])
    // The footage agent searches the first 5: all four literal phrasings plus the planner's first.
    expect(queryRewrites(s.queries, 'sleep tips')).toEqual(['charging phone', 'phone dresser', 'mobile charging', 'phone charger', 'phone charging'])
    // The #1190 pick 44082 (tags include charge, cable, phone) is a full match for the first literal search;
    // in the free probe it ranked #1 for these searches (it was not in the #1192 sc_12 candidates at all).
    expect(tagOverlap(queryWords('charging phone'), ['charge', 'cable', 'phone'])).toBe(2)
  })
  it('no searches returned: the old behaviour (planner queries, then two direct ideas)', () => {
    const out = applyScriptContext([shot('a', 'Line.', ['q1'])], { videoUnderstanding: '', lines: [{ lineNo: 1, showIdeas: ['idea one', 'idea two', 'idea three'] }] })
    expect((out.shots[0] as { queries: string[] }).queries).toEqual(['q1', 'idea one', 'idea two'])
  })
  it('drops sentence-like searches (Pixabay tags are 1-3 words)', () => {
    const out = applyScriptContext([shot('a', 'Line.', ['q1'])], { videoUnderstanding: '', lines: [{ lineNo: 1, searches: ['a person slowly arranging the bedding for comfort', 'making bed'] }] })
    expect((out.shots[0] as { queries: string[] }).queries).toEqual(['making bed', 'q1'])
  })
  it('the prompts ask for literal keyword searches of what a viewer should see, generically', () => {
    expect(SCRIPT_CONTEXT_SYSTEM).toMatch(/lineShows: in a few plain words, what a viewer should literally SEE/)
    expect(SCRIPT_CONTEXT_SYSTEM).toMatch(/advised action or its result, not the thing to stop/)
    expect(SCRIPT_CONTEXT_SYSTEM).toMatch(/ONE concrete everyday example/)
    expect(SCRIPT_CONTEXT_SYSTEM).toMatch(/searches: 4 short stock-video search queries for lineShows/)
    expect(REIMAGINE_SYSTEM).toMatch(/visible subject plus its action or place/)
    const rewriter = readFileSync(join(__dirname, '../lib/server/t2v/pipeline/t2v-query-rewriter.ts'), 'utf8')
    expect(rewriter).toMatch(/what a\s+viewer should literally SEE/)
    expect(rewriter).toMatch(/no broader topic B-roll/)
    expect(rewriter).not.toMatch(/broader B-roll that still fits/)
  })
  it('the checker gets the line\'s FIXED lineShows (search and checker share the target)', () => {
    const orch = readFileSync(join(__dirname, '../lib/server/t2v/pipeline/t2v-orchestrator.ts'), 'utf8')
    expect(orch).toMatch(/lineShows: fixedLineShows\(all, s\)/)
  })
})

describe('every query gets a turn (footage agent order)', () => {
  it('sleep sh4: "evening routine" no longer fills 7 of 8 slots; the literal searches are seen', () => {
    // Round-1 queries were all partial tag matches; the old sort (ratio, then query index) took 7 from query 1.
    const q = ['evening routine', 'setting alarm clock', 'reading bed lamp', 'bedroom']
    const pool: R[] = [
      ...['318540', '22634', '128361', '41725', '2582', '169690', '55190'].map((id, i) => hit(q[0]!, 0, i, id, 'sunset, evening, sky, clouds')),
      hit(q[1]!, 1, 0, '15629', 'alarm, clock, watch, time, retro, vintage'),
      hit(q[1]!, 1, 1, '21223', 'alarm clock, home, time, watch, hour, minute, alarm, deadline'),
      hit(q[2]!, 2, 0, '34473', 'woman, reading, book, bed, lamp, night'),
      hit(q[3]!, 3, 0, '230946', 'bedroom, bed, interior, room'),
    ]
    const top8 = interleaveQueries(pool).slice(0, 8).map((r) => r.id)
    expect(top8[0]).toBe('34473') // the only full match (reading in bed by a lamp)
    expect(top8).toEqual(expect.arrayContaining(['15629', '21223', '230946']))
    expect(top8.filter((id) => pool.find((r) => r.id === id)!.qi === 0)).toHaveLength(4) // not 7
  })
  it('snow sh16: equal-ratio hits from every query interleave instead of 8 of 8 from the first', () => {
    const q = ['outdoor grill', 'grill snow', 'barbecue winter']
    const pool: R[] = [
      ...['1645', '11632', '346604', '3187', '27445', '7021', '15573', '60010'].map((id, i) => hit(q[0]!, 0, i, id, 'bbq, grilling, barbecue, grill, food, summer, outdoor')),
      hit(q[1]!, 1, 0, '88187', 'barbecue, fireplace, grill, snow, fire'),
      hit(q[2]!, 2, 0, '88182', 'barbecue, fire, winter, embers'),
    ]
    const oldTop = [...pool].sort((a, b) => b.overlap / b.words - a.overlap / a.words || a.qi - b.qi || a.rank - b.rank).slice(0, 8)
    expect(oldTop.every((r) => r.qi === 0)).toBe(true)
    const top = interleaveQueries(pool).slice(0, 8).map((r) => r.id)
    expect(top.slice(0, 3)).toEqual(['1645', '88187', '88182'])
  })
  it('full tag matches still come before partial ones, across queries', () => {
    const pool: R[] = [
      { id: 'p1', overlap: 1, words: 2, qi: 0, rank: 0 },
      { id: 'f2', overlap: 2, words: 2, qi: 1, rank: 3 },
      { id: 'p2', overlap: 1, words: 2, qi: 1, rank: 0 },
      { id: 'f1', overlap: 2, words: 2, qi: 0, rank: 9 },
    ]
    expect(interleaveQueries(pool).map((r) => r.id)).toEqual(['f1', 'f2', 'p1', 'p2'])
  })
})

describe('a clip an earlier shot leads with stays in the list (not dropped)', () => {
  it('sleep sh10/sh12 (#1192): 44082 led sh10 and was dropped from sh12; now it is in sh12, just not first', async () => {
    // Real round-1 hits for "phone charging" (ids/tags from the run and the free probe; animations omitted).
    const tags: Record<string, string> = {
      '44082': 'charge, power, mobile, smartphone, energy, cellphone, digital, equipment, phone, battery, cable, device',
      '8501': 'charger, mobile, battery, technology, device, smart, screen, digital, display, charging, phone',
      '202987': 'phone, smartphone, mobile, portable, screen, digital', '38084': 'woman, phone, smartphone, technology',
      '174003': 'woman, social networking, post, phone', '47743': 'phone, hands, screen touch, smart phone, message',
      '142641': 'man, phone, smartphone, mobile', '6590': 'phone, night, bed', '61298': 'man, phone, camera, selfie',
      '88686': 'phone, desk, office',
    }
    // Provider order as in the run (numeric-looking keys would otherwise be re-ordered by Object.keys).
    const ids = ['44082', '8501', '202987', '38084', '174003', '47743', '142641', '6590', '61298', '88686']
    const hits = ids.map((id) => ({ id: Number(id), tags: tags[id], duration: 10, type: 'film', videos: { large: { url: `u${id}`, width: 1920, height: 1080 } } }))
    process.env.PIXABAY_API_KEY = 'test'
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((async () => new Response(JSON.stringify({ hits }), { status: 200 })) as never)
    try {
      const sh = (id: string) => ({ sceneId: id, segmentId: 's', voiceGroup: id, narration: 'x', intent: 'i', queries: ['phone charging'], subject: 's', needS: 3 }) as never
      const out = await t2vFootageAgent({ shots: [sh('sc_10'), sh('sc_12')], aspect: '16:9', rewrite: false })
      const lead10 = out.sc_10![0]!.providerId
      expect(lead10).toBe('44082')
      const ids12 = out.sc_12!.map((c) => c.providerId)
      expect(ids12).toHaveLength(8)
      expect(ids12).toContain('44082') // before: dropped (8 other phone clips filled the slots)
      expect(ids12[0]).not.toBe('44082')
      expect(ids12[0]).toBe('8501') // the other full match leads instead
    } finally {
      fetchMock.mockRestore()
      delete process.env.PIXABAY_API_KEY
    }
  })
})
