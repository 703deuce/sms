import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: vi.fn() }))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn() }))
import { enforceNoRepeatDeterministic, nearDuplicateHash, FILLER_MIN_SCORE, sameShoot, scarcityOrder, similarSubject } from '@/lib/server/t2v/pipeline/t2v-no-repeat'

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
  it('the better fit wins whatever its light; a spare is only placed after a 5+ re-check against its new line', () => {
    const data = {
      a: res('a', null, [pick('10', { lighting: 3, phash: uniq() }), pick('11', { score: 7, lighting: 8, phash: uniq() })]),
      b: res('b', pick('20', { phash: uniq() }), [pick('20', { phash: uniq() }), pick('21', { score: 8, phash: uniq() }), pick('22', { score: 9, phash: uniq() })]),
      c: res('c', null, [pick('30', { score: 1, phash: uniq() })]),
    }
    const first = enforceNoRepeatDeterministic([shot('a'), shot('b'), shot('c')], data, { realistic: true })
    expect(first.out.a!.chosen!.providerId).toBe('10')
    expect(first.out.c!.chosen).toBeNull() // no unchecked spare
    // c has no passing clip, so it picks first (scarcest) and every spare is still free to ask about.
    expect(first.spareRequests.c!.map((e) => e.providerId)).toEqual(['22', '20', '21', '10'])
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
  it('no time-of-day, brightness or colour gates: the reviewer score decides', () => {
    const night = pick('40', { timeOfDay: 'night', luma: 0.07, lighting: 2, phash: uniq() })
    const day = pick('41', { score: 6, phash: uniq() })
    const bw = pick('42', { saturation: 0.005, phash: uniq() })
    const { out, tiers } = enforceNoRepeatDeterministic([shot('a'), shot('b')], {
      a: res('a', night, [night, day]),
      b: res('b', bw, [bw, pick('44', { score: 6, phash: uniq() })]),
    }, { realistic: true })
    expect([out.a!.chosen!.providerId, tiers.a]).toEqual(['40', 'accepted'])
    expect([out.b!.chosen!.providerId, tiers.b]).toEqual(['42', 'accepted'])
  })
  it(`floor: nothing scoring below ${FILLER_MIN_SCORE}/10 is placed (no 0-3/10 filler)`, () => {
    const { out, tiers } = enforceNoRepeatDeterministic([shot('a'), shot('b')], {
      a: res('a', null, [pick('50', { score: 3, matches: false, phash: uniq() }), pick('51', { score: 4, matches: false, phash: uniq() })]),
      b: res('b', null, [pick('52', { score: 5, matches: false, phash: uniq() })]),
    }, { realistic: true })
    expect(out.a!.chosen).toBeNull()
    expect(tiers.a).toBeUndefined()
    expect(out.b!.chosen!.providerId).toBe('52')
  })
  it('scarcest scenes pick first: the line with one passing clip keeps it', () => {
    const shared = pick('60', { phash: uniq() })
    const data = {
      a: res('a', null, [shared, pick('61', { phash: uniq() }), pick('62', { phash: uniq() })]),
      b: res('b', null, [shared]),
    }
    expect(scarcityOrder([shot('a'), shot('b')], data, { realistic: true })).toEqual([1, 0])
    const r = enforceNoRepeatDeterministic([shot('a'), shot('b')], data, { realistic: true })
    expect(r.out.b!.chosen!.providerId).toBe('60')
    expect(r.out.a!.chosen!.providerId).not.toBe('60')
    // Ties keep story order.
    expect(scarcityOrder([shot('x'), shot('y')], { x: res('x', null, [pick('70')]), y: res('y', null, [pick('71')]) }, { realistic: true })).toEqual([0, 1])
  })
  it('logs why each passing clip is not on screen under its own line', () => {
    const shared = pick('60', { phash: uniq() })
    const r = enforceNoRepeatDeterministic([shot('a'), shot('b')], {
      a: res('a', null, [shared, pick('61', { score: 9, phash: uniq() })]),
      b: res('b', null, [shared]),
    }, { realistic: true })
    const why = Object.fromEntries(r.unused.map((u) => [`${u.sceneId}:${u.providerId}`, u.reason]))
    expect(why['a:60']).toBe('used_by:b')
    expect(r.unused.find((u) => u.sceneId === 'b')).toBeUndefined()
  })
})
