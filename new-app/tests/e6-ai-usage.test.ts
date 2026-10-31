import { vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { afterEach, describe, expect, it } from 'vitest'
import { clipsEditorLlmCostMicros, openAiUsdPer1M } from '@/lib/server/ai/clips-editor-llm'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'

describe('E6 AI usage cost', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('prices OpenAI tokens per 1M (the $97.60 rows were 1e6x too high)', () => {
    // ~180-token export headline: 140 in / 39 out at $0.10/$0.50 per 1M = 33.5 micro-USD, not $33.50.
    expect(clipsEditorLlmCostMicros('openai', 140, 39, 'gpt-6-luna')).toBe(34)
    expect(clipsEditorLlmCostMicros('openai', 1_000_000, 0, 'gpt-4o-mini')).toBe(150_000)
  })

  it('env overrides list price', () => {
    vi.stubEnv('CLIPS_LLM_USD_PER_1M_INPUT', '2')
    vi.stubEnv('CLIPS_LLM_USD_PER_1M_OUTPUT', '8')
    expect(openAiUsdPer1M('gpt-6-luna')).toEqual({ input: 2, output: 8 })
    expect(clipsEditorLlmCostMicros('openai', 1000, 1000, 'gpt-6-luna')).toBe(10_000)
  })

  it('openAiJsonResponse reports usage to onUsage and survives a logging failure', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"reply":"ok","tools":[]}' } }],
            usage: { prompt_tokens: 1200, completion_tokens: 80 },
          }),
          { status: 200 },
        ),
      ),
    )
    const onUsage = vi.fn(async () => {
      throw new Error('db down')
    })
    const out = await openAiJsonResponse<{ reply: string }>('sys', 'user', { onUsage })
    expect(out.reply).toBe('ok')
    expect(onUsage).toHaveBeenCalledWith(expect.objectContaining({ promptTokens: 1200, completionTokens: 80 }))
  })
})
