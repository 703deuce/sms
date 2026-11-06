import { afterEach, describe, expect, it, vi } from 'vitest'
import { __setLunaImpl } from '@/lib/ai-producer-agent/luna-client'
import { runStoryFinisher, verifyStoryFinish } from '@/lib/ai-producer-agent/story-finisher'
import { createEditorialHandoff } from '@/lib/ai-producer-agent/specialists'
import { Budget } from '@/lib/ai-producer-agent/budget'
import type { ToolCtx } from '@/lib/ai-producer-agent/tools/registry'
import type { OutputState } from '@/lib/ai-producer-agent/orchestrator'

vi.mock('@/lib/ai-producer-agent/log', () => ({
  logAiProducerStep: vi.fn(async () => undefined),
  redactArgs: (v: unknown) => v,
}))
vi.mock('@/lib/ai-producer-agent/tools/registry', () => ({
  runTool: vi.fn(async () => ({ ok: false, summary: 'unused' })),
}))

const part = (startMs: number, endMs: number, beat = 'story') =>
  ({ startMs, endMs, beat, reason: 'evidenced interview' })
// Reproduce six selections across 5:00–11:39, with a 99-second tail.
const footage = [
  part(300675, 311880, 'invitation'),
  part(450670, 478885, 'English challenge'),
  part(548520, 560245, 'recruitment'),
  part(561305, 564885, 'first attempt'),
  part(566750, 600040, 'preparation'),
  part(600040, 699275, 'passed test and unrelated later discussion'),
]
const compressed = [...footage.slice(0, 5), part(600040, 608040, 'passing the test')]
const payoff = { startMs: 604000, endMs: 606200, quote: 'passed it the second time' }
const outline = {
  logline: 'How a learner recovered from a failed entrance test',
  beats: ['challenge', 'first failure', 'prepared and passed'],
  audiencePromise: 'Learn how the candidate passed on her second attempt',
}
const words = [
  ...footage.flatMap((s, i) => Array.from({ length: 6 }, (_, j) => ({
    w: 'source', s: (s.startMs + 400 + j * 350) / 1000,
    e: (s.startMs + 550 + j * 350) / 1000,
  }))),
  ...['passed', 'it', 'the', 'second', 'time.'].map((w, i) => ({
    w, s: 604.1 + i * 0.4, e: 604.3 + i * 0.4,
  })),
  { w: 'In', s: 698.1, e: 698.3 }, { w: 'the', s: 698.5, e: 698.7 },
]
const ctx = (): ToolCtx => ({
  runId: 'real-187s-regression',
  sources: [{ sourceId: 'recording', rangeMs: [300000, 1500000] }],
  config: { editMode: 'just_chatting_rough_cut', roughCutIntent: 'story', targetLengthS: [75, 105] },
  cache: { words, momentsSummary: [], inventorySummary: [] },
} as unknown as ToolCtx)
const out = (): OutputState => ({
  index: 0, outputType: 'story', builder: null, notes: [],
} as unknown as OutputState)
const response = (name: string, args: unknown, id: string) => ({
  message: { role: 'assistant' as const, content: null, tool_calls: [{
    id, type: 'function' as const, function: { name, arguments: JSON.stringify(args) },
  }] },
  usage: { prompt_tokens: 120, completion_tokens: 80 },
})
afterEach(() => __setLunaImpl(null))

describe('source-verified Story Finisher', () => {
  it('compresses the 187s story to approximately 95s and ends near the real payoff', () => {
    const valid = verifyStoryFinish({
      selections: compressed, payoff,
      editorialReason: 'End after the second successful attempt; omit unrelated academy conversation.',
    }, footage, words, [300000, 1500000], [75, 105])
    expect(valid.selections).toEqual(compressed)
    expect(valid.selections.reduce((n, s) => n + s.endMs - s.startMs, 0) / 1000)
      .toBeCloseTo(96.015, 2)
    expect(valid.payoff.quote).toBe('passed it the second time')
  })
  it('rejects a fabricated payoff even if the timing seems plausible', () => {
    expect(() => verifyStoryFinish({
      selections: compressed, payoff: { ...payoff, quote: 'the DUI was dismissed' },
      editorialReason: 'Invented outcome',
    }, footage, words, [300000, 1500000], [75, 105]))
      .toThrow('finisher_unsourced_payoff_quote')
  })
  it('rejects retaining unrelated conversation or a dangling ending', () => {
    expect(() => verifyStoryFinish({
      selections: footage, payoff, editorialReason: 'Keep everything',
    }, footage, words, [300000, 1500000], [75, 105]))
      .toThrow('finisher_kept_conversation_after_payoff')
    expect(() => verifyStoryFinish({
      selections: [...footage.slice(0, 5), part(600040, 699275)],
      payoff: { startMs: 698000, endMs: 698800, quote: 'In the' },
      editorialReason: 'Mid-phrase is not a payoff',
    }, footage, words, [300000, 1500000], [75, 105]))
      .toThrow('finisher_mid_sentence_ending')
  })
  it('retries invalid evidence then returns a real sourced short edit', async () => {
    let n = 0
    __setLunaImpl(async ({ messages, tools }) => {
      expect(tools.map(t => t.name)).toEqual(['submit_story_finish'])
      expect(messages[1]?.content).toContain('wordEvidence')
      return response('submit_story_finish', {
        selections: compressed,
        payoff: n++ === 0 ? { ...payoff, quote: 'a fabricated DUI payoff' } : payoff,
        editorialReason: 'Trim to the spoken result.',
      }, 'finish' + n)
    })
    const decision = await runStoryFinisher(ctx(), new Budget(), outline, footage)
    expect(n).toBe(2)
    expect(decision.selections).toEqual(compressed)
  })
  it('invokes Finisher between Footage and Dialogue and preserves its verified ending', async () => {
    const names: string[] = []
    __setLunaImpl(async ({ tools, messages }) => {
      const name = tools[tools.length - 1]!.name
      names.push(name)
      if (name === 'submit_story_outline') return response(name, outline, 's')
      if (name === 'submit_footage_selections') return response(name, { selections: footage }, 'f')
      if (name === 'submit_story_finish') return response(name, {
        selections: compressed, payoff, editorialReason: 'End at verified passing of test',
      }, 'finish')
      if (name === 'submit_dialogue_cut_plan') {
        expect(messages[1]?.content).toContain('verifiedPayoff')
        // If Dialogue expands beyond the approval it cannot override the finisher.
        return response(name, { selections: compressed }, 'd')
      }
      throw new Error('Unexpected role ' + name)
    })
    const edit = await createEditorialHandoff(ctx(), out(), new Budget(), null)
    expect(names).toEqual([
      'submit_story_outline','submit_footage_selections','submit_footage_selections','submit_story_finish','submit_dialogue_cut_plan',
    ])
    expect(edit.finisher?.payoff).toEqual(payoff)
    expect(edit.cutPlan).toEqual(compressed)
    expect(edit.footage).toEqual(compressed)
  })
})
