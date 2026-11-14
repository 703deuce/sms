import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: vi.fn() }))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn() }))
import { enforceNoRepeatDeterministic, nearDuplicateHash, sameShoot } from '@/lib/server/t2v/pipeline/t2v-no-repeat'

let h = 0
const uniq = () => [(++h * 0x0f0f0f0f).toString(16).padStart(16, '0').slice(-16)]
const pick = (id: string, o: Partial<{ phash: string[]; score: number; author: string; lighting: number; matches: boolean }> = {}) => ({
  provider: 'pixabay', providerId: id, visible: '', matches: o.matches ?? true, score: o.score ?? 8, inS: 0, outS: 4, clipS: 10,
  style: 'live_action', lighting: o.lighting ?? 7, phash: o.phash ?? [], author: o.author, verdict: 'accepted' as const,
})
const shot = (sceneId: string) => ({ sceneId }) as never
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
    }, true)
    expect(out.a!.chosen!.providerId).toBe('1')
    expect(out.b!.chosen!.providerId).toBe('2')
    expect(out.c!.chosen).toBeNull()
  })
  it('never places the same shoot adjacent; uses a 5-6 clip before falling back', () => {
    const { out, tiers } = enforceNoRepeatDeterministic([shot('a'), shot('b')], {
      a: res('a', pick('24123', { author: 'WestNL', phash: uniq() })),
      b: res('b', pick('24122', { author: 'WestNL', phash: uniq() }), [pick('24122', { author: 'WestNL', phash: uniq() }), pick('500', { score: 5, matches: false, phash: uniq() })]),
    }, true)
    expect(out.b!.chosen!.providerId).toBe('500')
    expect(tiers.b).toBe('weak_match')
  })
  it('dark clips lose to lit ones; spare on-topic clip fills an empty scene', () => {
    const { out, tiers } = enforceNoRepeatDeterministic([shot('a'), shot('b'), shot('c')], {
      a: res('a', null, [pick('10', { lighting: 3, phash: uniq() }), pick('11', { score: 7, lighting: 8, phash: uniq() })]),
      b: res('b', pick('20', { phash: uniq() }), [pick('20', { phash: uniq() }), pick('21', { score: 8, phash: uniq() })]),
      c: res('c', null, [pick('30', { score: 1, phash: uniq() })]),
    }, true)
    expect(out.a!.chosen!.providerId).toBe('11')
    expect(out.c!.chosen!.providerId).toBe('21')
    expect(tiers.c).toBe('spare')
  })
})
