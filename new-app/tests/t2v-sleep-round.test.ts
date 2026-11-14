import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: vi.fn(async () => ({ scores: [] })) }))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn(), logT2vError: vi.fn() }))
vi.mock('@/lib/server/t2v/stock-asset', () => ({ ensureT2vStockAsset: async (_w: string, c: { providerId: string }) => ({ id: `asset_${c.providerId}` }) }))
import { aiBrollTargets } from '@/lib/server/t2v/pipeline/t2v-ai-broll'
import { enforceNoRepeatDeterministic, t2vAiAcceptable } from '@/lib/server/t2v/pipeline/t2v-no-repeat'
import { t2vFinisher } from '@/lib/server/t2v/pipeline/t2v-finisher'
import { equalTriplets, forceBreakEqualRuns, pacingStats, planPacing, type T2vPacedShot, type T2vPacingRow } from '@/lib/server/t2v/pipeline/t2v-pacing'
import { capExpansion, narrationWords } from '@/lib/server/t2v/pipeline/t2v-story-agent'

let n = 0
const hash = () => [(n++).toString(16).padStart(16, '0').replace(/0/g, () => 'abcdef0123456789'[(n * 7) % 16]!)]
const ev = (id: string, o: Record<string, unknown> = {}) => ({ provider: 'pixabay', providerId: id, visible: `v${id}`, subject: `s${id}`, matches: true, score: 8, inS: 0, outS: 4, clipS: 5, style: 'live_action', lighting: 7, phash: hash(), verdict: 'accepted', ...o })
const shot = (id: string, needS = 3) => ({ sceneId: id, segmentId: 's1', voiceGroup: `vg_${id}`, narration: `line ${id}`, intent: 'i', queries: ['q'], subject: 's', needS }) as never
const cand = (id: string, o: Record<string, unknown> = {}) => ({ provider: 'pixabay' as const, providerId: id, previewUrl: 'p', durationS: 20, width: 1920, height: 1080, query: 'q', tags: [], srcUrl: 's', thumbUrl: 't', pageUrl: 'u', author: 'a', ...o })

describe('sleep round: AI acceptance and targeting', () => {
  const ctx = { realistic: true }
  it('a 3d_render AI clip with content 8+ is accepted only when the best stock scores 4 or lower', () => {
    const ai = { score: 9, style: '3d_render', lighting: 8 }
    expect(t2vAiAcceptable(ai, ctx, 4)).toBe(true)
    expect(t2vAiAcceptable(ai, ctx, 5)).toBe(false)
    expect(t2vAiAcceptable({ ...ai, score: 7 }, ctx, 1)).toBe(false)
    expect(t2vAiAcceptable({ score: 6, style: 'live_action' }, ctx, 6)).toBe(true)
  })
  it('a good AI clip beats a 1-3 last resort in the pick pass (sleep sc_5 case)', () => {
    const data = { a: { sceneId: 'a', chosen: null, evaluated: [ev('1', { score: 3 }), ev('ai_1', { kind: 'ai', score: 9, style: '3d_render' })] } }
    const r = enforceNoRepeatDeterministic([shot('a')], data as never, { realistic: true })
    expect([r.out.a!.chosen!.providerId, r.tiers.a]).toEqual(['ai_1', 'ai'])
  })
  it('and in the finisher when the pick pass left the scene open', async () => {
    const results = [{ sceneId: 'a', chosen: null, evaluated: [ev('1', { score: 2 }), ev('ai_1', { kind: 'ai', score: 9, style: '3d_render', provider: 'replicate' })] }]
    const { results: out } = await t2vFinisher({
      workspaceId: 'w',
      doc: { settings: {} } as never,
      run: { style: 'documentary', prompt: 'sleep' } as never,
      story: { title: 'Sleep' } as never,
      segments: [],
      shots: [shot('a')],
      results: results as never,
      candidates: { a: [cand('1'), cand('ai_1', { provider: 'replicate', kind: 'ai' })] },
    })
    expect([out[0]!.chosen!.providerId, out[0]!.pickedBy]).toEqual(['ai_1', 'ai'])
  })
  it('targets lines with nothing at the floor (no clip 5+), max 3; brightness is not a reason to pay', () => {
    const shots = ['a', 'b', 'c', 'd', 'e', 'f'].map((x) => shot(x))
    const history = {
      a: { sceneId: 'a', chosen: null, evaluated: [ev('1', { score: 8 })] }, // good
      b: { sceneId: 'b', chosen: null, evaluated: [ev('2', { score: 3 })] }, // below the floor
      c: { sceneId: 'c', chosen: null, evaluated: [] }, // nothing
      d: { sceneId: 'd', chosen: null, evaluated: [ev('4', { score: 4 })] }, // below the floor
      e: { sceneId: 'e', chosen: null, evaluated: [ev('5', { score: 9, lighting: 2 })] }, // dim but fits: placed
      f: { sceneId: 'f', chosen: null, evaluated: [ev('6', { score: 3, matches: false })] },
    }
    const t = aiBrollTargets(shots, history as never, { realistic: true }).map((s) => (s as { sceneId: string }).sceneId)
    expect(t).toEqual(['b', 'c', 'd'])
    expect(t).not.toContain('e')
  })
})

describe('sleep round: no lighting gate (a dim bedroom can be exactly right)', () => {
  it('the best-fitting clip wins even when it is dark', async () => {
    const results = [
      { sceneId: 'a', chosen: null, evaluated: [ev('1', { score: 9, lighting: 3 }), ev('2', { score: 5, lighting: 8 })] },
    ]
    const nr = enforceNoRepeatDeterministic([shot('a')], { a: results[0] } as never, { realistic: true })
    expect(nr.out.a!.chosen?.providerId).toBe('1')
    const { results: out } = await t2vFinisher({
      workspaceId: 'w',
      doc: { settings: {} } as never,
      run: { style: 'documentary', prompt: 'sleep' } as never,
      story: { title: 'Sleep' } as never,
      segments: [],
      shots: [shot('a')],
      results: [{ sceneId: 'a', chosen: null, evaluated: [ev('1', { score: 9, lighting: 3 }), ev('2', { score: 5, lighting: 8 })] }] as never,
      candidates: { a: [cand('1'), cand('2')] },
    })
    expect(out[0]!.chosen!.providerId).toBe('1')
  })
})

describe('sleep round: forced pacing fix-up', () => {
  const ps = (id: string, text: string, vg = id): T2vPacedShot => ({ segmentId: 's1', voiceGroup: vg, wordOffset: 0, narration: text, sentence: text, beat: 'detail', intent: 'i', queries: ['q'], subject: 's', needS: Math.round((text.split(' ').length / 2.45 + 0.4) * 10) / 10 })
  it('breaks a run of 3 near-equal whole-sentence shots by merging or splitting a neighbour', () => {
    const eight = 'one two three four five six seven eight'
    const shots = [ps('a', eight), ps('b', eight), ps('c', eight), ps('d', 'a b c d e f g h i j k l m n o p q r s t')]
    expect(equalTriplets(shots.map((s) => s.needS))).toBe(1)
    const out = forceBreakEqualRuns(shots)
    expect(equalTriplets(out.map((s) => s.needS))).toBe(0)
    expect(out.map((s) => s.narration).join(' ')).toBe(shots.map((s) => s.narration).join(' '))
  })
  it('planner output never has 3 near-equal shots in a row across many seeds', () => {
    const rows: T2vPacingRow[] = Array.from({ length: 22 }, (_, i) => ({
      segmentId: `s${Math.floor(i / 4)}`,
      narration: 'Keep the bedroom cool, dark and quiet so your body can settle into rest',
      beat: (['detail', 'step', 'list', 'transition'] as const)[i % 4],
      intent: 'i',
      queries: ['q'],
      subject: 's',
    }))
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const st = pacingStats(planPacing(rows, { style: 'documentary', seed }).map((s) => s.needS))
      expect(st.longestEqualRun).toBeLessThan(3)
    }
  })
})

describe('sleep round: capped script expansion', () => {
  const seg = (i: number, w: number) => ({ id: `seg_${i}`, purpose: 'p', narration: Array.from({ length: w }, (_, k) => `w${k}`).join(' '), visualMeaning: '', emotion: '', targetSeconds: 0 })
  it('an overshooting rewrite is trimmed back segment by segment into ±8% of budget', () => {
    const orig = [seg(1, 30), seg(2, 30), seg(3, 30), seg(4, 30), seg(5, 30), seg(6, 35)] // 185
    const expanded = [seg(1, 45), seg(2, 44), seg(3, 43), seg(4, 44), seg(5, 43), seg(6, 44)] // 263
    const out = capExpansion(orig, expanded, 200)!
    const nw = narrationWords(out)
    expect(nw).toBeGreaterThanOrEqual(184)
    expect(nw).toBeLessThanOrEqual(216)
    expect(Math.abs(nw - 200)).toBeLessThan(Math.abs(185 - 200))
    expect(out.map((s) => s.id)).toEqual(orig.map((s) => s.id))
  })
  it('returns null when no mix lands in the window', () => {
    expect(capExpansion([seg(1, 50)], [seg(1, 300)], 200)).toBeNull()
  })
})
