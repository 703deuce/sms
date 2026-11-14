import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: vi.fn() }))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn() }))
import { enforceNoRepeatDeterministic, nearDuplicateHash } from '@/lib/server/t2v/pipeline/t2v-no-repeat'

const pick = (id: string, phash: string[], score = 8) => ({
  provider: 'pixabay', providerId: id, visible: '', matches: true, score, inS: 0, outS: 4, clipS: 10,
  style: 'live_action', lighting: 7, phash, verdict: 'accepted' as const,
})
const shot = (sceneId: string) => ({ sceneId }) as never

describe('t2v no-repeat', () => {
  it('hash threshold', () => {
    expect(nearDuplicateHash(['ffffffffffffffff'], ['fffffffffffffff0'])).toBe(true)
    expect(nearDuplicateHash(['ffffffffffffffff'], ['0000000000000000'])).toBe(false)
  })
  it('never reuses a clip id or a look-alike; takes the next distinct candidate', () => {
    const { out } = enforceNoRepeatDeterministic([shot('a'), shot('b'), shot('c')], {
      a: { sceneId: 'a', chosen: pick('1', ['ffffffffffffffff']), evaluated: [] },
      b: { sceneId: 'b', chosen: pick('1', ['ffffffffffffffff']), evaluated: [pick('2', ['0000000000000000'])] },
      c: { sceneId: 'c', chosen: pick('3', ['fffffffffffffff0']), evaluated: [pick('3', ['fffffffffffffff0'])] },
    }, true)
    expect(out.a!.chosen!.providerId).toBe('1')
    expect(out.b!.chosen!.providerId).toBe('2')
    expect(out.c!.chosen).toBeNull()
  })
})
