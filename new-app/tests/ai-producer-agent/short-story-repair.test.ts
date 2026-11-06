import { afterEach, describe, expect, it, vi } from 'vitest'
import { __setLunaImpl } from '@/lib/ai-producer-agent/luna-client'
import { createEditorialHandoff } from '@/lib/ai-producer-agent/specialists'
import { Budget } from '@/lib/ai-producer-agent/budget'
import type { ToolCtx } from '@/lib/ai-producer-agent/tools/registry'
import type { OutputState } from '@/lib/ai-producer-agent/orchestrator'

vi.mock('@/lib/ai-producer-agent/log', () => ({
  logAiProducerStep: vi.fn(async () => undefined),
  redactArgs: (a: unknown) => a,
}))
vi.mock('@/lib/ai-producer-agent/tools/registry', () => ({
  runTool: vi.fn(async () => ({ ok: false, summary: 'not_used' })),
}))
vi.mock('@/lib/ai-producer-agent/story-finisher', () => ({
  runStoryFinisher: vi.fn(async (_ctx: unknown, _budget: unknown, _outline: unknown, footage: Array<{startMs:number;endMs:number}>) => ({
    selections: footage,
    payoff: {
      startMs: footage[footage.length-1]!.endMs - 2000,
      endMs: footage[footage.length-1]!.endMs - 500,
      quote: 'word word',
    },
    editorialReason: 'Keep existing test emphasis on Footage and Dialogue',
  })),
}))

const brief = [
  { startMs: 20_000, endMs: 44_000, beat: 'setup', reason: 'a short source-grounded quote' },
]
const complete = [
  { startMs: 20_000, endMs: 48_000, beat: 'setup', reason: 'establish the problem' },
  { startMs: 70_000, endMs: 97_000, beat: 'development', reason: 'show the complication' },
  { startMs: 150_000, endMs: 184_000, beat: 'payoff', reason: 'deliver the result' },
]
const outline = {
  logline: 'A discussion moves from problem to resolution',
  audiencePromise: 'Understand what happened',
  beats: ['setup', 'development', 'payoff'],
}
function context(): ToolCtx {
  return {
    runId: 'run90',
    sources: [{ sourceId: 'recording', rangeMs: [0, 300_000] }],
    cache: { words: Array.from({ length: 600 }, (_, i) => ({
      w: 'word', s: i * 0.5 + 0.1, e: i * 0.5 + 0.3,
    })), momentsSummary: [], inventorySummary: {} },
    config: { editMode: 'just_chatting_rough_cut', targetLengthS: [75, 105] },
  } as unknown as ToolCtx
}
function output(): OutputState {
  return { index: 0, outputType: 'story', builder: null, notes: [] } as unknown as OutputState
}
function mockSequence(items: Array<[string, object]>) {
  let i = 0
  __setLunaImpl(async ({ tools, messages }) => {
    const next = items[i++]
    if (!next) throw new Error('extra specialist invocation ' + i)
    expect(tools.some((t) => t.name === next[0])).toBe(true)
    if (i === 3) {
      // The repair request names the previous cut and its missing duration.
      expect(messages[1]?.content).toContain('missingSecondsToMinimum')
    }
    return {
      message: { role: 'assistant', content: null, tool_calls: [{
        id: 's' + i, type: 'function',
        function: { name: next[0], arguments: JSON.stringify(next[1]) },
      }] },
      usage: { prompt_tokens: 80, completion_tokens: 30 },
    }
  })
  return () => i
}
afterEach(() => __setLunaImpl(null))

describe('90-second story completion', () => {
  it('requests a fuller source-grounded edit rather than accepting a lone 24s excerpt', async () => {
    const calls = mockSequence([
      ['submit_story_outline', outline],
      ['submit_footage_selections', { selections: brief }],
      ['submit_footage_selections', { selections: complete }],
      ['submit_dialogue_cut_plan', { selections: complete }],
    ])
    const cut = await createEditorialHandoff(context(), output(), new Budget(), null)
    expect(calls()).toBe(4)
    expect(cut.footage).toHaveLength(3)
    expect(cut.cutPlan).toHaveLength(3)
    expect(cut.cutPlan.reduce((n, s) => n + s.endMs - s.startMs, 0)).toBe(89_000)
  })

  it('restores curated story beats when Dialogue collapses a complete 90s edit', async () => {
    const calls = mockSequence([
      ['submit_story_outline', outline],
      ['submit_footage_selections', { selections: complete }],
      ['submit_dialogue_cut_plan', { selections: brief }],
    ])
    const cut = await createEditorialHandoff(context(), output(), new Budget(), null)
    expect(calls()).toBe(3)
    expect(cut.cutPlan).toEqual(cut.footage)
    expect(cut.cutPlan).toHaveLength(3)
  })

  it('keeps the strongest existing excerpt when the revised selection is no better', async () => {
    const calls = mockSequence([
      ['submit_story_outline', outline],
      ['submit_footage_selections', { selections: brief }],
      ['submit_footage_selections', { selections: brief }],
      ['submit_dialogue_cut_plan', { selections: brief }],
    ])
    const cut = await createEditorialHandoff(context(), output(), new Budget(), null)
    expect(calls()).toBe(4)
    expect(cut.cutPlan).toEqual(brief)
  })
})
