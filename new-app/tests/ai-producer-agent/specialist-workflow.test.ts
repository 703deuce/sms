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
      { logline: 'A streamer explains and reacts to a story', audiencePromise: 'Understand the topic', beats: ['setup','detail','payoff'] },
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
    expect(toolNames[0]).toContain('get_transcript')
    expect(toolNames[1]).toContain('analyze_visual')
    expect(toolNames[2]).toContain('get_audio_energy')
    expect(budget.steps).toBe(3)
  })
})
