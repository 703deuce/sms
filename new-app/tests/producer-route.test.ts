import { describe, expect, it, vi } from 'vitest'
import { applyProducerTools } from '@/lib/clips/edits-reducer'
import { defaultEdits } from '@/lib/clips/edits'

vi.mock('@/lib/server/ai/openai-json', () => ({
  openAiJsonResponse: vi.fn(async () => ({
    reply: 'Done',
    tools: [{ name: 'set_layout', args: { mode: 'fit_blur' } }],
  })),
}))

describe('producer tool application', () => {
  it('applies layout from mocked planner output', () => {
    const bounds = { clipStartMs: 0, clipEndMs: 30_000 }
    const { edits } = applyProducerTools(defaultEdits(bounds), bounds, [
      { name: 'set_layout', args: { mode: 'fit_blur' } },
    ])
    expect(edits.layout.mode).toBe('fit_blur')
  })
})
