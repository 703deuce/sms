import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: vi.fn() }))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn() }))
vi.mock('@/lib/server/t2v/stock-asset', () => ({ ensureT2vStockAsset: async (_w: string, c: { providerId: string }) => ({ id: `asset_${c.providerId}` }) }))
import { t2vFinisher } from '@/lib/server/t2v/pipeline/t2v-finisher'

const cand = (id: string) => ({ provider: 'pixabay' as const, providerId: id, previewUrl: 'p', durationS: 20, width: 1920, height: 1080, query: 'q', tags: [], srcUrl: 's', thumbUrl: 't', pageUrl: 'u', author: 'a' })
const pick = (id: string, verdict: 'accepted' | 'best_available' = 'accepted') => ({ provider: 'pixabay', providerId: id, visible: '', matches: true, score: 8, inS: 1, outS: 6, clipS: 20, verdict })
const shot = (sceneId: string, narration: string, voiceGroup: string, segmentId = 's1') => ({ sceneId, segmentId, narration, intent: 'i', queries: ['q'], needS: 3, voiceGroup })

describe('t2v finisher: split sentences become in-scene cuts', () => {
  it('pieces of one sentence share one scene and narration, later pieces cut at their first word', async () => {
    const shots = [
      shot('a', 'A cup of coffee begins on a hillside.', 'vg_0'),
      shot('b', 'Workers move along the rows,', 'vg_1'),
      shot('c', 'picking ripe cherries by hand,', 'vg_1'),
      shot('d', 'while baskets slowly fill.', 'vg_1'),
    ]
    const results = [
      { sceneId: 'a', chosen: pick('1'), evaluated: [] },
      { sceneId: 'b', chosen: pick('2'), evaluated: [] },
      { sceneId: 'c', chosen: pick('3'), evaluated: [] },
      { sceneId: 'd', chosen: null, evaluated: [{ ...pick('4'), score: 3 }] }, // weak but its own: never a held repeat
    ]
    const { scenes, results: out } = await t2vFinisher({
      workspaceId: 'w',
      doc: { settings: { captionsEnabled: true } } as never,
      run: { style: 'documentary', prompt: 'coffee' } as never,
      story: { title: 'Coffee' } as never,
      segments: [],
      shots: shots as never,
      results: results as never,
      candidates: { a: [cand('1')], b: [cand('2')], c: [cand('3')], d: [cand('4')] },
    })
    expect(scenes).toHaveLength(2) // 2 voice scenes; no end card (no text cards)
    expect(scenes.every((sc) => !sc.texts?.length)).toBe(true) // no opening title overlay
    expect(scenes.some((sc) => sc.media.kind === 'color')).toBe(false)
    expect(scenes[1]!.narration).toBe('Workers move along the rows, picking ripe cherries by hand, while baskets slowly fill.')
    expect(scenes[1]!.cuts).toEqual([
      { atWord: 5, media: expect.objectContaining({ providerId: '3' }) },
      { atWord: 10, media: expect.objectContaining({ providerId: '4' }) },
    ])
    expect(scenes[1]!.media.providerId).toBe('2')
    expect(out.map((r) => r.pickedBy)).toEqual(['accepted', 'accepted', 'accepted', 'fallback'])
  })
})
