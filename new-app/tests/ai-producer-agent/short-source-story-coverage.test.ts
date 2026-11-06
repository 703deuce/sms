import { afterEach, describe, expect, it, vi } from 'vitest'
import { __setLunaImpl } from '@/lib/ai-producer-agent/luna-client'
import { Budget } from '@/lib/ai-producer-agent/budget'
import { createEditorialHandoff, shortStoryCoverage } from '@/lib/ai-producer-agent/specialists'
import type { ToolCtx } from '@/lib/ai-producer-agent/tools/registry'
import type { OutputState } from '@/lib/ai-producer-agent/orchestrator'

vi.mock('@/lib/ai-producer-agent/log', () => ({
  logAiProducerStep: vi.fn(async () => undefined), redactArgs: (a: unknown) => a,
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
      quote: 'story story',
    },
    editorialReason: 'Isolated legacy Footage coverage behavior',
  })),
}))

const local = [
  { startMs: 300_675, endMs: 322_175, beat: 'setup', reason: 'father and California' },
  { startMs: 322_195, endMs: 338_070, beat: 'turning point', reason: 'church and ambitions' },
  { startMs: 338_890, endMs: 366_640, beat: 'development', reason: 'academy, dangling ending' },
]
const distributed = [
  { startMs: 300_675, endMs: 326_675, beat: 'setup', reason: 'origin of the change' },
  { startMs: 710_000, endMs: 740_000, beat: 'development', reason: 'real-world challenge' },
  { startMs: 1_120_000, endMs: 1_155_000, beat: 'payoff', reason: 'actual outcome' },
]
const outline = { logline: 'A personal transformation', audiencePromise: 'What changed and why',
  beats: ['setup', 'challenge', 'payoff'],
  intendedPayoff: 'The meaningful recorded conclusion',
  essentialSetup: 'Enough context for an independent viewer',
  excludeAsides: [],
  endingRule: 'End when the recorded point resolves',
  highlightCriteria: 'Standalone, distinct moments',
}
const words = Array.from({ length: 1200 }, (_, i) => ({
  w: i === 66 ? 'just...' : 'story.',
  s: 300.4 + i, e: 300.6 + i,
}))
const context = () => ({
  runId: 'short-local', sources: [{ sourceId: 'recording', rangeMs: [300_000, 1_500_000] }],
  cache: { words, momentsSummary: [], inventorySummary: {} },
  config: { editMode: 'just_chatting_rough_cut', targetLengthS: [75, 105] },
} as unknown as ToolCtx)
const output = () => ({ index: 0, outputType: 'story', builder: null, notes: [] } as unknown as OutputState)

afterEach(() => __setLunaImpl(null))

function fakeModel(steps: Array<[string, Record<string, unknown>]>) {
  let n = 0
  const prompts: string[] = []
  __setLunaImpl(async ({ messages, tools }) => {
    const [name, args] = steps[n++] ?? []
    if (!name) throw Error('unexpected extra editorial call')
    expect(tools.some(t => t.name === name)).toBe(true)
    prompts.push(messages[1]?.content ?? '')
    return { message: { role: 'assistant', content: null, tool_calls: [{
      id: 'step' + n, type: 'function', function: { name, arguments: JSON.stringify(args) },
    }] }, usage: { prompt_tokens: 50, completion_tokens: 50 } }
  })
  return { count: () => n, prompts }
}

describe('short-form narrative coverage', () => {
  it('recognizes the actual 65s retest as a local excerpt, not complete full-window coverage', () => {
    const coverage = shortStoryCoverage(local, words, [75, 105], [300_000, 1_500_000])
    expect(coverage.durationSeconds).toBeCloseTo(65.125, 1)
    expect(coverage.longestSourceGapMs).toBe(820)
    expect(coverage.localOnly).toBe(true)
    expect(coverage.needsReview).toBe(true)
  })

  it('lets Footage choose distant beats directly from the complete 20-minute transcript',async()=>{
    const model=fakeModel([
      ['submit_story_outline',outline],
      ['submit_footage_word_selections',{selections:[
        {firstWordId:0,lastWordId:25,beat:'setup',reason:'origin'},
        {firstWordId:400,lastWordId:430,beat:'challenge',reason:'actual struggle'},
        {firstWordId:820,lastWordId:855,beat:'payoff',reason:'actual recorded outcome'},
      ]}],
    ])
    const result=await createEditorialHandoff(context(),output(),new Budget(),null)
    expect(model.count()).toBe(2)
    expect(model.prompts[0]).toContain('fullTranscript')
    expect(model.prompts[1]).toContain('fullTranscript')
    expect(model.prompts[1]).not.toContain('transcriptSamples')
    expect(result.cutPlan).toHaveLength(3)
    expect(result.cutPlan[2]!.startMs-result.cutPlan[1]!.endMs).toBeGreaterThan(300000)
  })

  it('does not fabricate unrelated distant beats to reach the duration target',async()=>{
    const model=fakeModel([
      ['submit_story_outline',outline],
      ['submit_footage_word_selections',{selections:[
        {firstWordId:0,lastWordId:20,beat:'setup',reason:'complete local thought'},
        {firstWordId:24,lastWordId:50,beat:'resolution',reason:'coherent local outcome'},
      ]}],
    ])
    const result=await createEditorialHandoff(context(),output(),new Budget(),null)
    expect(model.count()).toBe(2)
    expect(result.cutPlan).toHaveLength(2)
    expect(result.cutPlan[1]!.startMs-result.cutPlan[0]!.endMs).toBeLessThan(5000)
    expect(result.cutPlan.reduce((n,x)=>n+x.endMs-x.startMs,0)).toBeLessThan(75000)
  })
})
