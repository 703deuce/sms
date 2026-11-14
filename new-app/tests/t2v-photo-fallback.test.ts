import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: vi.fn() }))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn(), logT2vError: vi.fn() }))
import { enforceNoRepeatDeterministic } from '@/lib/server/t2v/pipeline/t2v-no-repeat'
import { looksNonPhoto, photoFromPixabay } from '@/lib/server/t2v/pipeline/t2v-footage-agent'

const hash = () => [Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')]
const ev = (id: string, o: { score?: number; kind?: 'photo'; matches?: boolean; phash?: string[] } = {}) => ({
  provider: 'pixabay' as const, providerId: id, visible: '', matches: o.matches ?? true, score: o.score ?? 8, inS: 0, outS: 6, clipS: 12,
  style: 'live_action', lighting: 7, phash: o.phash ?? hash(), ...(o.kind ? { kind: o.kind } : {}), verdict: 'accepted' as const,
})
const shot = (sceneId: string) => ({ sceneId, narration: '', intent: '' }) as never

describe('t2v photo fallback', () => {
  it('order: video (5+) first, then photo (5+), then re-checked spare, then related fallback', () => {
    const data = {
      a: { sceneId: 'a', chosen: null, evaluated: [ev('1', { score: 6, matches: false }), ev('img_9', { kind: 'photo', score: 9 })] },
      b: { sceneId: 'b', chosen: null, evaluated: [ev('2', { score: 3 }), ev('img_8', { kind: 'photo', score: 7 })] },
      c: { sceneId: 'c', chosen: null, evaluated: [ev('3', { score: 3 }), ev('img_7', { kind: 'photo', score: 4 })] },
    }
    const r = enforceNoRepeatDeterministic([shot('a'), shot('b'), shot('c')], data, { realistic: true })
    expect([r.out.a!.chosen!.providerId, r.tiers.a]).toEqual(['1', 'usable'])
    expect([r.out.b!.chosen!.providerId, r.tiers.b]).toEqual(['img_8', 'photo'])
    expect(r.out.b!.chosen!.kind).toBe('photo')
    // Photo below 5 is not a photo pick; the 3/10 related video is the fallback.
    expect([r.out.c!.chosen!.providerId, r.tiers.c]).toEqual(['3', 'fallback'])
  })
  it('photos are never offered as spares and never repeat', () => {
    const same = hash()
    const data = {
      a: { sceneId: 'a', chosen: null, evaluated: [ev('img_1', { kind: 'photo', score: 8, phash: same })] },
      b: { sceneId: 'b', chosen: null, evaluated: [ev('img_1', { kind: 'photo', score: 8, phash: same })] },
    }
    const r = enforceNoRepeatDeterministic([shot('a'), shot('b')], data, { realistic: true })
    expect(r.out.a!.chosen!.providerId).toBe('img_1')
    expect(r.out.b!.chosen).toBeNull()
    expect(r.spareRequests.b ?? []).toEqual([])
  })
  it('pixabay photo mapping and live-action filter', () => {
    const c = photoFromPixabay({ id: 42, largeImageURL: 'https://pixabay.com/get/x.jpg', webformatURL: 'https://pixabay.com/get/y.jpg', tags: 'coffee, cherries', user: 'u', imageWidth: 1920, imageHeight: 1280 } as never, 'coffee cherries')!
    expect(c.kind).toBe('photo')
    expect(c.providerId).toBe('img_42')
    expect(c.srcUrl).toContain('x.jpg')
    expect(looksNonPhoto({ type: 'photo', tags: 'coffee, beans' })).toBe(false)
    expect(looksNonPhoto({ type: 'illustration', tags: 'coffee' })).toBe(true)
    expect(looksNonPhoto({ type: 'photo', tags: 'coffee, vector, icon' })).toBe(true)
    expect(looksNonPhoto({ type: 'photo', tags: 'ai generated, coffee' })).toBe(true)
  })
})
