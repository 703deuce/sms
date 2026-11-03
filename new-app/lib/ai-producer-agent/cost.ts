import { AI_PRODUCER_AGENT_GEMINI_USD_CAP } from '@/lib/ai-producer-agent/flags'

export function estimateGeminiUsdFromTokens(inputTokens: number, outputTokens: number): number {
  const inRate = 0.75 / 1_000_000
  const outRate = 3.75 / 1_000_000
  return inputTokens * inRate + outputTokens * outRate
}

export function estimateLunaUsd(inputTokens: number, outputTokens: number, cachedRatio = 0.85): number {
  const uncached = inputTokens * (1 - cachedRatio) * (0.1 / 1_000_000)
  const cached = inputTokens * cachedRatio * (0.01 / 1_000_000)
  const out = outputTokens * (0.5 / 1_000_000)
  return uncached + cached + out
}

export function geminiCapExceeded(spentUsd: number): boolean {
  return spentUsd >= AI_PRODUCER_AGENT_GEMINI_USD_CAP
}
