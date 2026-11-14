import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const llm = vi.fn()
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: (...a: unknown[]) => llm(...a) }))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn(), logT2vError: vi.fn() }))
import { enforceNoRepeat } from '@/lib/server/t2v/pipeline/t2v-no-repeat'
import { aiBrollTargets } from '@/lib/server/t2v/pipeline/t2v-ai-broll'

const hashes = ['0000000000000000', 'ffffffffffffffff', '0f0f0f0f0f0f0f0f', 'f0f0f0f0f0f0f0f0', '00ff00ff00ff00ff', 'ff00ff00ff00ff00']
const ev = (id: string, h: number, o: Record<string, unknown> = {}) => ({ provider: 'pixabay', providerId: id, visible: `v${id}`, subject: `subject ${id}`, matches: true, score: 8, inS: 0, outS: 4, clipS: 5, style: 'live_action', lighting: 7, phash: [hashes[h]!], verdict: 'accepted', ...o })
const shot = (id: string) => ({ sceneId: id, segmentId: 's', voiceGroup: id, narration: `line ${id}`, intent: 'i', queries: ['q'], subject: 's', needS: 3 }) as never

describe('look-alike pairs drop the side that can afford it', () => {
  it('a good AI clip keeps its place; the twin with another good clip swaps', async () => {
    let seqCalls = 0
    llm.mockImplementation(async (system: string) => (system.includes('repetition') ? (seqCalls++ ? { pairs: [], sameKind: [] } : { pairs: [[0, 1]], sameKind: [] }) : { scores: [] }))
    const history = {
      a: { sceneId: 'a', chosen: null, evaluated: [ev('1', 0, { score: 10 }), ev('2', 2, { score: 8 })] },
      b: { sceneId: 'b', chosen: null, evaluated: [ev('3', 1, { score: 2 }), ev('ai_1', 3, { kind: 'ai', score: 9, style: '3d_render', provider: 'replicate' })] },
    }
    const r = await enforceNoRepeat([shot('a'), shot('b')], history as never, { realistic: true })
    expect(r.results.b!.chosen!.providerId).toBe('ai_1')
    expect(r.results.a!.chosen!.providerId).toBe('2')
    expect(r.banned.a).toEqual(['1'])
  })
  it('when neither side has another good clip, the weaker pick yields (not simply the later one)', async () => {
    let seqCalls = 0
    llm.mockImplementation(async (system: string) => (system.includes('repetition') ? (seqCalls++ ? { pairs: [], sameKind: [] } : { pairs: [[0, 1]], sameKind: [] }) : { scores: [] }))
    const history = {
      a: { sceneId: 'a', chosen: null, evaluated: [ev('1', 0, { score: 6, matches: false })] },
      b: { sceneId: 'b', chosen: null, evaluated: [ev('2', 1, { score: 9 })] },
    }
    const r = await enforceNoRepeat([shot('a'), shot('b')], history as never, { realistic: true })
    expect(r.banned).toEqual({ a: ['1'] })
    expect(r.results.b!.chosen!.providerId).toBe('2')
  })
  it('AI targets follow the full pass: a scene the sequence check emptied is targeted first', () => {
    const shots = [shot('a'), shot('b'), shot('c')]
    const history = {
      a: { sceneId: 'a', chosen: null, evaluated: [ev('1', 0)] },
      b: { sceneId: 'b', chosen: null, evaluated: [ev('2', 1)] },
      c: { sceneId: 'c', chosen: null, evaluated: [ev('3', 2, { score: 3 })] },
    }
    const predicted = {
      out: { a: { ...history.a, chosen: ev('1', 0) }, b: { ...history.b, chosen: null }, c: { ...history.c, chosen: ev('3', 2, { score: 3 }) } },
      tiers: { a: 'accepted', c: 'fallback' },
    }
    const t = aiBrollTargets(shots, history as never, { realistic: true }, predicted as never).map((s) => (s as { sceneId: string }).sceneId)
    expect(t).toEqual(['b', 'c'])
  })
})
