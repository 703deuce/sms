import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  lunaTokenCostMicros,
  openAiStockVisionModelId,
  openAiStockVisionReasoningEffort,
  resolveStockVisionBackend,
  typicalLunaStockVisionCostUsdMicros,
} from '@/lib/server/t2v/stock-vision-config'

describe('resolveStockVisionBackend', () => {
  const env = process.env

  afterEach(() => {
    process.env = { ...env }
    vi.unstubAllEnvs()
  })

  it('defaults to openai-luna when OPENAI_API_KEY is set', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    vi.stubEnv('STOCK_VISION_MODEL', '')
    vi.stubEnv('GEMINI_API_KEY', '')
    expect(resolveStockVisionBackend()).toBe('openai-luna')
  })

  it('honors gemini override', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    vi.stubEnv('STOCK_VISION_MODEL', 'gemini-flash-lite')
    vi.stubEnv('GEMINI_API_KEY', 'g-test')
    expect(resolveStockVisionBackend()).toBe('gemini-flash-lite')
  })

  it('uses explicit gpt model id via openai path', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    vi.stubEnv('STOCK_VISION_MODEL', 'gpt-6-luna')
    expect(openAiStockVisionModelId()).toBe('gpt-6-luna')
  })
})

describe('lunaTokenCostMicros', () => {
  it('applies $0.10 / $0.50 per M input/output', () => {
    expect(lunaTokenCostMicros(1_000_000, 0)).toBe(100_000)
    expect(lunaTokenCostMicros(0, 1_000_000)).toBe(500_000)
    expect(lunaTokenCostMicros(107, 25)).toBe(Math.round(107 * 0.1 + 25 * 0.5))
  })
})

describe('openAiStockVisionReasoningEffort', () => {
  it('defaults to none', () => {
    vi.stubEnv('STOCK_VISION_REASONING_EFFORT', '')
    expect(openAiStockVisionReasoningEffort()).toBe('none')
  })
})

describe('typicalLunaStockVisionCostUsdMicros', () => {
  it('12-scene cold pass is sub-cent at Luna list price', () => {
    const micros = typicalLunaStockVisionCostUsdMicros(12)
    expect(micros).toBe(lunaTokenCostMicros(12 * 5 * 85 + 2 * 1200 + 800, 12 * 28))
    expect(micros).toBeLessThan(2_000)
  })
})
