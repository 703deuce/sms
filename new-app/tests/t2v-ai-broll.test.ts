import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: vi.fn() }))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn(), logT2vError: vi.fn() }))
import { aiBrollEnabled, aiCandidate, aiFramesFor, fallbackAiPrompt } from '@/lib/server/t2v/pipeline/t2v-ai-broll'
import { enforceNoRepeatDeterministic } from '@/lib/server/t2v/pipeline/t2v-no-repeat'

const hash = () => [Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')]
const ev = (id: string, o: Record<string, unknown> = {}) => ({ provider: 'pixabay', providerId: id, visible: '', matches: true, score: 8, inS: 0, outS: 4, clipS: 5, style: 'live_action', lighting: 7, phash: hash(), verdict: 'accepted', ...o })
const shot = (id: string) => ({ sceneId: id, narration: '', intent: '' }) as never

describe('t2v AI b-roll test step', () => {
  it('is off unless the flag or the per-run option is set', () => {
    delete process.env.T2V_AI_BROLL_TEST
    expect(aiBrollEnabled({})).toBe(false)
    expect(aiBrollEnabled({ aiBroll: true })).toBe(true)
    process.env.T2V_AI_BROLL_TEST = '1'
    expect(aiBrollEnabled({})).toBe(true)
    delete process.env.T2V_AI_BROLL_TEST
  })
  it('clip length follows the planned shot: 81..121 frames at 24 fps', () => {
    expect(aiFramesFor(2)).toBe(81)
    expect(aiFramesFor(4)).toBe(101)
    expect(aiFramesFor(9)).toBe(121)
    const c = aiCandidate({ sceneId: 's', predictionId: 'p1', numFrames: 81, fps: 24, prompt: 'x', createdAt: '' }, 'https://replicate.delivery/x.mp4')
    expect(c).toMatchObject({ kind: 'ai', provider: 'replicate', providerId: 'ai_p1', durationS: 3.38 })
    expect(fallbackAiPrompt({ intent: 'beans tumble in a drum', subject: 'coffee roasting drum' })).toMatch(/no text, no logos/)
  })
  it('stock that truly works wins; AI beats sub-floor stock; a failed AI clip is never used', () => {
    const data = {
      a: { sceneId: 'a', chosen: null, evaluated: [ev('1', { score: 6, matches: false }), ev('ai_1', { kind: 'ai', score: 9 })] },
      b: { sceneId: 'b', chosen: null, evaluated: [ev('2', { score: 3 }), ev('ai_2', { kind: 'ai', score: 8 })] },
      c: { sceneId: 'c', chosen: null, evaluated: [ev('3', { score: 3 }), ev('ai_3', { kind: 'ai', score: 3 })] },
    }
    const r = enforceNoRepeatDeterministic([shot('a'), shot('b'), shot('c')], data as never, { realistic: true })
    expect([r.out.a!.chosen!.providerId, r.tiers.a]).toEqual(['1', 'usable'])
    expect([r.out.b!.chosen!.providerId, r.tiers.b]).toEqual(['ai_2', 'ai'])
    expect(r.out.c!.chosen).toBeNull() // 3/10 stock and a 3/10 AI clip: both below the floor
  })
})
