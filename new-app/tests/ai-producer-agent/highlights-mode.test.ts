import { afterEach, describe, expect, it, vi } from 'vitest'
import { __setLunaImpl } from '@/lib/ai-producer-agent/luna-client'
import { createEditorialHandoff, highlightsCoverage } from '@/lib/ai-producer-agent/specialists'
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
vi.mock('@/lib/ai-producer-agent/story-finisher', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai-producer-agent/story-finisher')>()),
  runStoryBoundaryFinisher: vi.fn(async (_ctx: unknown, _budget: unknown, _outline: unknown, footage: Array<{startMs:number;endMs:number}>) => footage),
  runStoryFinisher: vi.fn(async (_ctx: unknown, _budget: unknown, _outline: unknown, footage: Array<{startMs:number;endMs:number}>) => ({
    selections: footage,
    payoff: {
      startMs: footage[footage.length-1]!.endMs - 2000,
      endMs: footage[footage.length-1]!.endMs - 500,
      quote: 'word word',
    },
    editorialReason: 'Keep existing test emphasis on Footage and Dialogue',
  })),
  runHighlightsFinisher: vi.fn(async (_ctx: unknown, _budget: unknown, _outline: unknown, footage: Array<{startMs:number;endMs:number;beat:string;reason:string}>) => ({
    selections: footage,
    moments: footage.map(selection => ({
      selection,
      landing: { startMs: selection.endMs - 1800, endMs: selection.endMs - 500, quote: 'word word' },
      editorialReason: 'Mocked per-moment ending for legacy Highlights coverage test',
    })),
    editorialReason: 'Keep existing test focused on original highlight selection',
  })),
}))

const sel = (startMs: number, endMs: number, beat = 'interesting moment') =>
  ({ startMs, endMs, beat, reason: 'real memorable sourced exchange' })
const local = [
  sel(300_000, 322_000), sel(322_020, 341_000), sel(341_820, 365_000),
]
const spread = [
  sel(300_000, 324_000, 'surprise'),
  sel(620_000, 648_000, 'funny moment'),
  sel(1_100_000, 1_140_400, 'insight'),
]
const words = Array.from({ length: 2400 }, (_, i) => ({
  w: i % 10 === 0 ? 'thing.' : 'word',
  s: 300 + i * 0.5 + 0.1,
  e: 300 + i * 0.5 + 0.3,
}))
const outline = { logline: 'Best moments of this interview', audiencePromise: 'Three revealing exchanges', beats: ['surprise', 'humor', 'insight'],
  intendedPayoff: 'The meaningful recorded conclusion',
  essentialSetup: 'Enough context for an independent viewer',
  excludeAsides: [],
  endingRule: 'End when the recorded point resolves',
  highlightCriteria: 'Standalone, distinct moments',
}

function ctx(intent: 'story' | 'highlights' = 'highlights'): ToolCtx {
  return {
    runId: 'highlights-run', sources: [{ sourceId: 'recording', rangeMs: [300_000, 1_500_000] }],
    cache: { words, momentsSummary: [], inventorySummary: {} },
    config: {
      editMode: 'just_chatting_rough_cut', roughCutIntent: intent,
      targetLengthS: [75, 105], memeSfx: 'off',
    },
  } as unknown as ToolCtx
}
function output(): OutputState {
  return { index: 0, outputType: 'story', builder: null, notes: [] } as unknown as OutputState
}
function mockRoles(items: Array<[string, Record<string, unknown>]>) {
  let n = 0
  __setLunaImpl(async ({ tools, messages }) => {
    const item = items[n++]
    if (!item) throw new Error('Unexpected extra agent invocation')
    expect(tools.some(t => t.name === item[0])).toBe(true)
    if (n === 3) {
      expect(messages[1]?.content).toContain('HIGHLIGHTS REVISION')
      expect(messages[1]?.content).toContain('previousCoverage')
    }
    return {
      message: { role: 'assistant', content: null, tool_calls: [{
        id: 'highlights-call-' + n, type: 'function',
        function: { name: item[0], arguments: JSON.stringify(item[1]) },
      }] },
      usage: { prompt_tokens: 40, completion_tokens: 20 },
    }
  })
  return () => n
}
afterEach(() => __setLunaImpl(null))

describe('distinct highlights mode', () => {
  it('does not count breath cuts as three highlights', () => {
    expect(highlightsCoverage(local, [75, 105])).toMatchObject({
      distinctMomentCount: 1, minimumDistinct: 3, needsRevision: true,
    })
    expect(highlightsCoverage(spread, [75, 105])).toMatchObject({
      distinctMomentCount: 3, minimumDistinct: 3, needsRevision: false,
    })
    expect(highlightsCoverage([sel(300_000, 313_000), sel(650_000, 668_000)], [25, 40]))
      .toMatchObject({ distinctMomentCount: 2, minimumDistinct: 2, needsRevision: false })
  })
  it('rescans distant moments and keeps all distinct choices through Dialogue', async () => {
    const calls = mockRoles([
      ['submit_story_outline', outline],
      ['submit_footage_selections', { selections: local }],
      ['submit_footage_selections', { selections: spread }],
      ['submit_dialogue_cut_plan', { selections: [spread[0]] }],
    ])
    const edit = await createEditorialHandoff(ctx(), output(), new Budget(), null)
    expect(calls()).toBe(4)
    expect(edit.footage).toEqual(spread)
    expect(edit.cutPlan).toEqual(spread)
    expect(highlightsCoverage(edit.cutPlan, [75, 105]).distinctMomentCount).toBe(3)
  })
  it('does not add source-diversity requirements to Story mode', async () => {
    const calls = mockRoles([
      ['submit_story_outline', outline],
      ['submit_footage_selections', { selections: spread }],
      ['submit_dialogue_cut_plan', { selections: spread }],
    ])
    const edit = await createEditorialHandoff(ctx('story'), output(), new Budget(), null)
    expect(calls()).toBe(3)
    expect(edit.cutPlan).toEqual(spread)
  })
})
