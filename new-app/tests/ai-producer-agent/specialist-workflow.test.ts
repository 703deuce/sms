import { afterEach, describe, expect, it, vi } from 'vitest'
import { __setLunaImpl } from '@/lib/ai-producer-agent/luna-client'
import { Budget } from '@/lib/ai-producer-agent/budget'
import { createEditorialHandoff } from '@/lib/ai-producer-agent/specialists'
import type { ToolCtx } from '@/lib/ai-producer-agent/tools/registry'
import type { OutputState } from '@/lib/ai-producer-agent/orchestrator'

vi.mock('@/lib/ai-producer-agent/log', () => ({
  logAiProducerStep: vi.fn(async () => undefined),
  redactArgs: (args: unknown) => args,
}))
vi.mock('@/lib/ai-producer-agent/tools/registry', () => ({
  runTool: vi.fn(async () => ({ ok: false, summary: 'not_used' })),
}))

afterEach(() => __setLunaImpl(null))

describe('AI Producer specialist execution', () => {
  it('invokes distinct role prompts and isolated tool menus, carrying a validated handoff', async () => {
    const sequence = ['submit_story_outline', 'submit_footage_selections', 'submit_dialogue_cut_plan']
    const toolNames: string[][] = []
    const prompts: string[] = []
    const selected = [
      { startMs: 0, endMs: 110_000, beat: 'setup', reason: 'complete opening topic' },
      { startMs: 140_000, endMs: 290_000, beat: 'payoff', reason: 'complete follow-up' },
    ]
    const submissions = [
      { logline: 'A streamer explains and reacts to a story', audiencePromise: 'Understand the topic', beats: ['setup','detail','payoff'],
  intendedPayoff: 'Actual recorded result to verify',
  essentialSetup: 'Source-grounded setup',
  excludeAsides: [],
  endingRule: 'Finish on a complete resolution',
  highlightCriteria: 'Independent, compelling moments' },
      { selections: selected },
      { selections: selected },
    ]
    let index = 0
    __setLunaImpl(async ({ messages, tools }) => {
      const stage = index++
      toolNames.push(tools.map((tool) => tool.name))
      prompts.push(messages[0]!.content)
      return {
        message: {
          role: 'assistant', content: null,
          tool_calls: [{
            id: `specialist_${stage}`, type: 'function',
            function: { name: sequence[stage]!, arguments: JSON.stringify(submissions[stage]) },
          }],
        },
        usage: { prompt_tokens: 200, completion_tokens: 50 },
      }
    })
    const words = Array.from({ length: 150 }, (_, i) =>
      ({ w: 'word', s: i * 2 + 0.3, e: i * 2 + 0.8 }))
    const ctx = {
      runId: 'run1', sources: [{ sourceId:'source1', rangeMs:[0,300_000] }],
      cache: { words, momentsSummary: [{ start_s: 4, end_s: 40 }], inventorySummary: { rows: [] } },
      config: { targetLengthS: [180, 480] },
    } as unknown as ToolCtx
    const out = { index: 0, outputType:'story', builder: null, notes: [] } as unknown as OutputState
    const budget = new Budget()
    const handoff = await createEditorialHandoff(ctx, out, budget, 'Make this conversational')
    expect(handoff.outline.beats).toEqual(['setup','detail','payoff'])
    expect(handoff.footage).toHaveLength(2)
    expect(handoff.cutPlan).toEqual(selected)
    expect(prompts).toHaveLength(3)
    expect(prompts[0]).toContain('STORY EDITOR')
    expect(prompts[1]).toContain('FOOTAGE SELECTOR')
    expect(prompts[2]).toContain('DIALOGUE/CUT EDITOR')
    for (const names of toolNames) {
      expect(names).not.toContain('add_clip_segment')
      expect(names).not.toContain('create_project')
    }
    // Story now has every transcript word in its initial context and has no
    // reason to retrieve disconnected snippets.
    expect(toolNames[0]).not.toContain('get_transcript')
    expect(toolNames[0]).toContain('submit_story_outline')
    expect(toolNames[1]).toContain('analyze_visual')
    expect(toolNames[2]).toContain('get_audio_energy')
    expect(budget.steps).toBe(3)
  })
  it('delivers a coherent short cut instead of rejecting the edit for duration', async () => {
    const selected = [
      { startMs: 0, endMs: 55_000, beat: 'setup', reason: 'complete opening' },
      { startMs: 140_000, endMs: 200_000, beat: 'payoff', reason: 'complete response' },
    ]
    const submissions = [
      ['submit_story_outline', { logline: 'A story', audiencePromise: 'Context', beats: ['setup', 'detail', 'payoff'],
  intendedPayoff: 'Actual recorded result to verify',
  essentialSetup: 'Source-grounded setup',
  excludeAsides: [],
  endingRule: 'Finish on a complete resolution',
  highlightCriteria: 'Independent, compelling moments' }],
      ['submit_footage_selections', { selections: selected }],
      ['submit_dialogue_cut_plan', { selections: selected }],
    ] as const
    let callIndex = 0
    __setLunaImpl(async ({ tools }) => {
      const [name, args] = submissions[callIndex++]!
      expect(tools.some((t) => t.name === name)).toBe(true)
      return {
        message: { role: 'assistant', content: null, tool_calls: [
          { id: `short_${callIndex}`, type: 'function', function: { name, arguments: JSON.stringify(args) } },
        ] },
        usage: { prompt_tokens: 200, completion_tokens: 50 },
      }
    })
    const words = Array.from({ length: 150 }, (_, i) =>
      ({ w: 'word', s: i * 2 + 0.3, e: i * 2 + 0.8 }))
    const ctx = {
      runId: 'short-run', sources: [{ sourceId: 'source1', rangeMs: [0, 300_000] }],
      cache: { words, momentsSummary: [], inventorySummary: { rows: [] } },
      config: { targetLengthS: [180, 480] },
    } as unknown as ToolCtx
    const out = { index: 0, outputType: 'story', builder: null, notes: [] } as unknown as OutputState
    const handoff = await createEditorialHandoff(ctx, out, new Budget(), null)
    expect(callIndex).toBe(3)
    expect(handoff.cutPlan).toEqual(selected)
  })

  it('recovers an unsnappable Footage proposal without retrying seven times', async () => {
    const selected = [
      { startMs: 10_000, endMs: 20_000, beat: 'setup', reason: 'complete discussion' },
      { startMs: 140_000, endMs: 190_000, beat: 'payoff', reason: 'complete follow-up' },
    ]
    const payload = [
      ['submit_story_outline', { logline: 'Discussion', audiencePromise: 'A conversation',
        beats: ['opening', 'discussion', 'conclusion'],
  intendedPayoff: 'Actual recorded result to verify',
  essentialSetup: 'Source-grounded setup',
  excludeAsides: [],
  endingRule: 'Finish on a complete resolution',
  highlightCriteria: 'Independent, compelling moments' }],
      ['submit_footage_selections', { selections: selected }],
      ['submit_dialogue_cut_plan', { selections: selected }],
    ] as const
    let called = 0
    __setLunaImpl(async () => {
      const [name, body] = payload[called++]!
      return {
        message: { role: 'assistant', content: null, tool_calls: [{
          id: 'dense_' + called, type: 'function',
          function: { name, arguments: JSON.stringify(body) },
        }] },
        usage: { prompt_tokens: 150, completion_tokens: 50 },
      }
    })
    const dense = Array.from({ length: 350 }, (_, i) => ({
      w: 'speech', s: i * 0.12, e: i * 0.12 + 0.15,
    }))
    const second = Array.from({ length: 100 }, (_, i) => ({
      w: 'speech', s: 140 + i * 0.5, e: 140 + i * 0.5 + 0.2,
    }))
    const ctx = {
      runId: 'dense-run', sources: [{ sourceId: 'source1', rangeMs: [0, 300_000] }],
      cache: { words: [...dense, ...second], momentsSummary: [], inventorySummary: { rows: [] } },
      config: { targetLengthS: [180, 480] },
    } as unknown as ToolCtx
    const out = { index: 0, outputType: 'story', builder: null, notes: [] } as unknown as OutputState
    const handoff = await createEditorialHandoff(ctx, out, new Budget(), null)
    expect(called).toBe(3)
    expect(handoff.footage.length).toBeGreaterThan(0)
    expect(handoff.cutPlan.length).toBeGreaterThan(0)
  })

})
