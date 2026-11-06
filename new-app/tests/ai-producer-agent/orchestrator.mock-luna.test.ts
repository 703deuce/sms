import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { __setLunaImpl } from '@/lib/ai-producer-agent/luna-client'
import { runAiProducerAgent } from '@/lib/ai-producer-agent/orchestrator'
import { Budget, CAPS } from '@/lib/ai-producer-agent/budget'

vi.mock('@/lib/server/db', () => {
  const runs = new Map<string, Record<string, unknown>>()
  const steps: unknown[] = []
  return {
    getPrisma: () => ({
      aiProducerAgentRun: {
        findUniqueOrThrow: async ({ where }: { where: { id: string } }) => runs.get(where.id),
        findUnique: async ({ where }: { where: { id: string } }) => runs.get(where.id),
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = { ...(runs.get(where.id) as object), ...data }
          runs.set(where.id, row)
          return row
        },
      },
      aiProducerAgentStep: { create: async ({ data }: { data: unknown }) => steps.push(data) },
      clipJob: { create: async () => ({ id: 'job1' }) },
      clip: {
        findUniqueOrThrow: async () => ({ id: 'clip1', startMs: 0, endMs: 300_000, editsSaveVersion: 0 }),
      },
      clipProject: { findFirstOrThrow: async () => ({ uploadId: 'u1', settings: {}, title: 't' }) },
      $transaction: async (fn: (tx: unknown) => Promise<void>) =>
        fn({
          clipProject: { create: async () => {} },
          clip: { create: async () => {} },
        }),
    }),
    __runs: runs,
    __steps: steps,
  }
})

vi.mock('@/lib/server/ai-producer-agent/rough-cut-source', () => ({
  loadRoughCutWords: async () => Array.from({ length: 150 }, (_, i) => ({
    w: 'word', s: i * 2 + 0.3, e: i * 2 + 0.8,
  })),
}))

vi.mock('@/lib/server/ai-producer-agent/resolve-sources', () => ({
  resolveAiProducerSources: async (_ws: string, sources: unknown[]) => sources,
}))

vi.mock('@/lib/server/ai-producer-agent/enqueue-analyze.ts', () => ({
  enqueueAiProducerAnalyzeJob: async () => ({ id: 'j1' }),
  waitForClipJobDone: async () => ({
    payload: {
      analyzeResult: {
        moments: [{ sourceId: 'src_A', start_s: 10, end_s: 25, score: 0.9, what_happened: 'payoff' }],
      },
    },
  }),
}))

vi.mock('@/lib/server/ai-producer-agent/create-output-project.ts', () => ({
  createAiProducerOutputProject: async () => ({ projectId: 'proj1', clipId: 'clip1' }),
}))

vi.mock('@/lib/server/clips/write-clip-edits.ts', () => ({
  writeClipEditsOrThrow: vi.fn(async () => ({ ok: true })),
}))

type Step = { tool: string; args: object } | { text: string }

function script(steps: Step[]) {
  let i = 0
  return async () => {
    const s = steps[i++] ?? { tool: 'finish_edit', args: { story: 'done' } }
    if ('text' in s) {
      return {
        message: { role: 'assistant' as const, content: s.text, tool_calls: [] },
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      }
    }
    return {
      message: {
        role: 'assistant' as const,
        content: null,
        tool_calls: [
          {
            id: 'c' + i,
            type: 'function' as const,
            function: { name: s.tool, arguments: JSON.stringify(s.args) },
          },
        ],
      },
      usage: { prompt_tokens: 100, completion_tokens: 20 },
    }
  }
}

describe('orchestrator with mocked Luna', () => {
  beforeEach(async () => {
    const db = await import('@/lib/server/db')
    const runs = (db as unknown as { __runs: Map<string, Record<string, unknown>> }).__runs
    runs.clear()
    runs.set('run1', {
      id: 'run1',
      workspaceId: 'ws1',
      status: 'queued',
      genre: 'irl_just_chatting',
      outputType: 'single_payoff',
      platform: 'tiktok',
      instruction: null,
      config: { targetLengthS: [15, 30], memeSfx: 'subtle', music: 'none', exportOnFinish: false, geminiUsdCap: 3 },
      sourceSnapshot: [{ sourceId: 'src_A', kind: 'clip', projectId: 'p1', clipId: 'c0', durationMs: 120_000 }],
      createdById: 'u1',
    })
  })

  afterEach(() => {
    __setLunaImpl(null)
  })

  it('happy path creates project', async () => {
    __setLunaImpl(
      script([
        { tool: 'create_project', args: { title: 't', sources: ['src_A'], aspect: '9:16', outputType: 'single_payoff' } },
        { tool: 'add_clip_segment', args: { sourceId: 'src_A', srcInMs: 10_000, srcOutMs: 25_000, beat: 'payoff' } },
        { tool: 'validate_plan', args: {} },
        { tool: 'finish_edit', args: { story: 'x' } },
      ]) as never,
    )
    await runAiProducerAgent('run1')
    const db = await import('@/lib/server/db')
    const run = (db as unknown as { __runs: Map<string, Record<string, unknown>> }).__runs.get('run1')
    if (run?.status !== 'ready') {
      expect(run?.error).toBeUndefined()
    }
    expect(run?.status).toBe('ready')
    expect(run?.resultProjectId).toBe('proj1')
  })

  it('step cap marks capped', () => {
    const b = new Budget()
    b.steps = CAPS.hardSteps
    expect(b.state()).toBe('hard')
  })
  it('creates an editable rough cut without waiting for assembly Luna tool calls', async () => {
    const db = await import('@/lib/server/db')
    const runs = (db as unknown as { __runs: Map<string, Record<string, unknown>> }).__runs
    runs.set('run1', {
      ...runs.get('run1'),
      outputType: 'story',
      config: {
        editMode: 'just_chatting_rough_cut', targetLengthS: [180, 480],
        memeSfx: 'off', music: 'none', exportOnFinish: false, geminiUsdCap: 3,
      },
      sourceSnapshot: [{
        sourceId: 'src_A', kind: 'clip', projectId: 'p1', clipId: 'c0',
        durationMs: 300_000, rangeMs: [0, 300_000],
      }],
    })
    const selected = [
      { startMs: 0, endMs: 55_000, beat: 'setup', reason: 'full context' },
      { startMs: 140_000, endMs: 200_000, beat: 'payoff', reason: 'complete answer' },
    ]
    let calls = 0
    const toolNames = ['submit_story_outline', 'submit_footage_selections',
      'submit_dialogue_cut_plan', 'submit_editorial_review']
    const submissions = [
      { logline: 'The story', audiencePromise: 'Understand the answer', beats: ['setup', 'detail', 'payoff'],
  intendedPayoff: 'Actual recorded result to verify',
  essentialSetup: 'Source-grounded setup',
  excludeAsides: [],
  endingRule: 'Finish on a complete resolution',
  highlightCriteria: 'Independent, compelling moments' },
      { selections: selected }, { selections: selected }, { pass: true, issues: [] },
    ]
    __setLunaImpl(async () => {
      const idx = calls++
      if (idx >= submissions.length) throw new Error('Unexpected Luna assembly call')
      return {
        message: {
          role: 'assistant' as const, content: null,
          tool_calls: [{
            id: 'cut_' + idx, type: 'function' as const,
            function: { name: toolNames[idx]!, arguments: JSON.stringify(submissions[idx]) },
          }],
        },
        usage: { prompt_tokens: 100, completion_tokens: 30 },
      }
    })
    await runAiProducerAgent('run1')
    const run = runs.get('run1')
    expect(run?.error).toBeNull()
    expect(run?.status).toBe('ready')
    expect(run?.resultProjectId).toBe('proj1')
    expect(calls).toBe(4) // Story, Footage, Dialogue, QA; no Luna assembly.
    const notes = run?.producerNotes as { outputs: { specialists: { approvedCuts: unknown[] } }[] }
    expect(notes.outputs[0]?.specialists.approvedCuts).toHaveLength(2)
  })

})
