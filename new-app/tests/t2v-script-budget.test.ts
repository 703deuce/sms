import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/t2v/log', () => ({ logT2v: vi.fn() }))
const llm = vi.fn()
vi.mock('@/lib/server/t2v/pipeline/t2v-llm', () => ({ t2vLlmJson: (...a: unknown[]) => llm(...a) }))
import { expandToBudget, narrationWords, tightenToBudget, wordBudget } from '@/lib/server/t2v/pipeline/t2v-story-agent'

const seg = (words: number, i = 0) => ({ id: `seg_${i}`, purpose: 'p', narration: Array(words).fill('word').join(' '), visualMeaning: '', emotion: '', targetSeconds: 0 })

describe('t2v script word budget', () => {
  beforeEach(() => llm.mockReset())
  it('90 s budget is calibrated on finished-video pace (~2.3 words/s, no end-card seconds)', () => {
    expect(wordBudget(90)).toBe(207) // no end card: the whole 90 s is narration
  })
  it('leaves scripts within 5% alone (no LLM call)', async () => {
    const segs = [seg(105), seg(105, 1)] // 210 words vs 201 (+4.5%)
    expect(await tightenToBudget(segs, 201)).toBe(segs)
    expect(llm).not.toHaveBeenCalled()
  })
  it('runs one tightening rewrite when more than 5% over', async () => {
    llm.mockResolvedValueOnce({ segments: [{ purpose: 'p', narration: Array(100).fill('w').join(' ') }, { purpose: 'q', narration: Array(98).fill('w').join(' ') }] })
    const out = await tightenToBudget([seg(118), seg(118, 1)], 201)
    expect(llm).toHaveBeenCalledTimes(1)
    expect(narrationWords(out)).toBe(198)
  })
  it('keeps the original if the rewrite is drastically short or the call fails', async () => {
    const segs = [seg(118), seg(118, 1)]
    llm.mockResolvedValueOnce({ segments: [{ purpose: 'p', narration: 'too short now' }] })
    expect(await tightenToBudget(segs, 201)).toBe(segs)
    llm.mockRejectedValueOnce(new Error('boom'))
    expect(await tightenToBudget(segs, 201)).toBe(segs)
  })
  it('runs one expansion rewrite when more than 5% under (189 vs 201 -> expand)', async () => {
    llm.mockResolvedValueOnce({ segments: [{ purpose: 'p', narration: Array(100).fill('w').join(' ') }, { purpose: 'q', narration: Array(99).fill('w').join(' ') }] })
    const out = await expandToBudget([seg(95), seg(94, 1)], 201)
    expect(llm).toHaveBeenCalledTimes(1)
    expect(narrationWords(out)).toBe(199)
  })
  it('expansion leaves near-budget scripts alone and rejects overshoots', async () => {
    const near = [seg(100), seg(95, 1)] // 195 >= 191
    expect(await expandToBudget(near, 201)).toBe(near)
    expect(llm).not.toHaveBeenCalled()
    const short = [seg(90), seg(90, 1)]
    llm.mockResolvedValueOnce({ segments: [{ purpose: 'p', narration: Array(240).fill('w').join(' ') }] })
    expect(await expandToBudget(short, 201)).toBe(short)
  })
})
