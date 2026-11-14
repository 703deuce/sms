import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: vi.fn() }))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn() }))
import { enforceNoRepeatDeterministic, nearDuplicateHash, sameShoot, similarSubject, t2vMonoRequested, t2vNightLine } from '@/lib/server/t2v/pipeline/t2v-no-repeat'

let h = 0
// Random 64-bit hashes: two of them are within 10 bits with negligible probability.
const uniq = () => {
  h++
  return [Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')]
}
const pick = (id: string, o: Partial<{ phash: string[]; score: number; author: string; lighting: number; matches: boolean; timeOfDay: string; saturation: number; luma: number; subject: string }> = {}) => ({
  provider: 'pixabay', providerId: id, visible: '', matches: o.matches ?? true, score: o.score ?? 8, inS: 0, outS: 4, clipS: 10,
  style: 'live_action', lighting: o.lighting ?? 7, phash: o.phash ?? [], author: o.author, timeOfDay: o.timeOfDay, saturation: o.saturation, luma: o.luma, subject: o.subject, verdict: 'accepted' as const,
})
const shot = (sceneId: string, narration = '') => ({ sceneId, narration, intent: '' }) as never
const res = (sceneId: string, chosen: ReturnType<typeof pick> | null, evaluated: ReturnType<typeof pick>[] = []) => ({ sceneId, chosen, evaluated })

describe('t2v no-repeat', () => {
  it('hash threshold', () => {
    expect(nearDuplicateHash(['ffffffffffffffff'], ['fffffffffffffff0'])).toBe(true)
    expect(nearDuplicateHash(['ffffffffffffffff'], ['0000000000000000'])).toBe(false)
  })
  it('same shoot = same author with neighbouring ids', () => {
    expect(sameShoot({ providerId: '24122', author: 'WestNL' }, { providerId: '24123', author: 'WestNL' })).toBe(true)
    expect(sameShoot({ providerId: '24122', author: 'WestNL' }, { providerId: '99999', author: 'WestNL' })).toBe(false)
    expect(sameShoot({ providerId: '24122', author: 'A' }, { providerId: '24123', author: 'B' })).toBe(false)
  })
  it('never reuses a clip id or a look-alike; takes the next distinct candidate', () => {
    const { out } = enforceNoRepeatDeterministic([shot('a'), shot('b'), shot('c')], {
      a: res('a', pick('1', { phash: ['ffffffffffffffff'] })),
      b: res('b', pick('1', { phash: ['ffffffffffffffff'] }), [pick('2', { phash: ['0000000000000000'] })]),
      c: res('c', pick('3', { phash: ['fffffffffffffff0'] }), [pick('3', { phash: ['fffffffffffffff0'] })]),
    }, { realistic: true })
    expect(out.a!.chosen!.providerId).toBe('1')
    expect(out.b!.chosen!.providerId).toBe('2')
    expect(out.c!.chosen).toBeNull()
  })
  it('never places the same shoot adjacent; uses a 5-6 clip before falling back', () => {
    const { out, tiers } = enforceNoRepeatDeterministic([shot('a'), shot('b')], {
      a: res('a', pick('24123', { author: 'WestNL', phash: uniq() })),
      b: res('b', pick('24122', { author: 'WestNL', phash: uniq() }), [pick('24122', { author: 'WestNL', phash: uniq() }), pick('500', { score: 5, matches: false, phash: uniq() })]),
    }, { realistic: true })
    expect(out.b!.chosen!.providerId).toBe('500')
    expect(tiers.b).toBe('usable')
  })
  it('dark clips lose to lit ones; a spare is only placed after a 5+ re-check against its new line', () => {
    const data = {
      a: res('a', null, [pick('10', { lighting: 3, phash: uniq() }), pick('11', { score: 7, lighting: 8, phash: uniq() })]),
      b: res('b', pick('20', { phash: uniq() }), [pick('20', { phash: uniq() }), pick('21', { score: 8, phash: uniq() }), pick('22', { score: 9, phash: uniq() })]),
      c: res('c', null, [pick('30', { score: 1, phash: uniq() })]),
    }
    const first = enforceNoRepeatDeterministic([shot('a'), shot('b'), shot('c')], data, { realistic: true })
    expect(first.out.a!.chosen!.providerId).toBe('11')
    expect(first.out.c!.chosen).toBeNull() // no unchecked spare
    expect(first.spareRequests.c!.map((e) => e.providerId)).toEqual(['22', '21'])
    // 22 fails the re-check for line c (mug under a harvesting line); 21 works there (6/10).
    const second = enforceNoRepeatDeterministic([shot('a'), shot('b'), shot('c')], data, { realistic: true, spareScores: { c: { '22': 2, '21': 6 } } })
    expect(second.out.c!.chosen!.providerId).toBe('21')
    expect(second.out.c!.chosen!.score).toBe(6) // scored against the line it sits under
    expect(second.out.c!.chosen!.reviewedForOtherLine).toBe(8)
    expect(second.tiers.c).toBe('spare')
  })
  it('same author + same subject counts as a near-repeat even with far-apart ids', () => {
    expect(similarSubject('roasted coffee beans', 'Roasted coffee beans')).toBe(true)
    expect(similarSubject('roasted coffee beans', 'coffee mug')).toBe(false)
    expect(sameShoot({ providerId: '80138', author: 'TPMotion', subject: 'roasted coffee beans' }, { providerId: '82604', author: 'TPMotion', subject: 'roasted coffee beans' })).toBe(true)
    const { out } = enforceNoRepeatDeterministic([shot('a'), shot('b'), shot('c')], {
      a: res('a', pick('80138', { author: 'TPMotion', subject: 'roasted coffee beans', phash: uniq() })),
      b: res('b', pick('500', { phash: uniq(), subject: 'moka pot' })),
      c: res('c', pick('82604', { author: 'TPMotion', subject: 'roasted coffee beans', phash: uniq() }), [pick('82604', { author: 'TPMotion', subject: 'roasted coffee beans', phash: uniq() }), pick('600', { score: 6, subject: 'coffee pouring', phash: uniq() })]),
    }, { realistic: true })
    expect(out.c!.chosen!.providerId).toBe('600')
  })
  it('night/dark clips only for night lines; black-and-white only when requested; records how each was picked', () => {
    const night = pick('40', { timeOfDay: 'night', luma: 0.07, phash: uniq() })
    const day = pick('41', { score: 6, phash: uniq() })
    const bw = pick('42', { saturation: 0.005, phash: uniq() })
    const { out, tiers } = enforceNoRepeatDeterministic([shot('a', 'Drivers start the day with a full battery.'), shot('b', 'City lights glow at night.'), shot('c', 'Parked cars line the street.')], {
      a: res('a', night, [night, day]),
      b: res('b', null, [pick('43', { timeOfDay: 'night', luma: 0.07, phash: uniq() })]),
      c: res('c', bw, [bw, pick('44', { score: 3, phash: uniq() })]),
    }, { realistic: true })
    expect(out.a!.chosen!.providerId).toBe('41')
    expect(tiers.a).toBe('usable')
    expect(out.b!.chosen!.providerId).toBe('43')
    expect(tiers.b).toBe('accepted')
    expect(out.c!.chosen!.providerId).toBe('44')
    expect(tiers.c).toBe('fallback')
    const mono = enforceNoRepeatDeterministic([shot('c')], { c: res('c', bw, [bw]) }, { realistic: true, monoOk: true })
    expect(mono.out.c!.chosen!.providerId).toBe('42')
  })
  it('night and black-and-white detection', () => {
    expect(t2vNightLine('Headlights stream past after dark.')).toBe(true)
    expect(t2vNightLine('A family loads the car on a sunny morning.')).toBe(false)
    expect(t2vMonoRequested('a black and white documentary about trains')).toBe(true)
    expect(t2vMonoRequested('why EVs are gaining ground')).toBe(false)
  })
})
