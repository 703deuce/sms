import 'server-only'
import { geminiVisionConfigured } from '@/lib/server/ai/gemini-flash-lite'

export type StockVisionBackend = 'openai-luna' | 'gemini-flash-lite'

const LUNA_MODEL_ID = 'gpt-6-luna'

/** STOCK_VISION_MODEL: `gpt-6-luna` | `luna` | `openai-luna` | `gemini` | `gemini-flash-lite` | explicit OpenAI model id */
export function resolveStockVisionBackend(): StockVisionBackend | null {
  const raw = (process.env.STOCK_VISION_MODEL || '').trim().toLowerCase()
  if (raw === 'gemini' || raw === 'gemini-flash-lite' || raw === 'flash-lite') {
    return geminiVisionConfigured() ? 'gemini-flash-lite' : null
  }
  if (raw === 'luna' || raw === 'openai-luna' || raw === LUNA_MODEL_ID) {
    return process.env.OPENAI_API_KEY?.trim() ? 'openai-luna' : null
  }
  if (raw.startsWith('gpt-')) {
    return process.env.OPENAI_API_KEY?.trim() ? 'openai-luna' : null
  }
  // Default: gpt-6-luna (low-detail images) when OpenAI is configured, else Gemini Flash-Lite.
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai-luna'
  if (geminiVisionConfigured()) return 'gemini-flash-lite'
  return null
}

export function openAiStockVisionModelId(): string {
  const raw = (process.env.STOCK_VISION_MODEL || '').trim()
  if (raw.startsWith('gpt-')) return raw
  return LUNA_MODEL_ID
}

/** $0.10 / $0.50 per 1M input/output tokens (gpt-6-luna). */
export function lunaTokenCostMicros(promptTokens: number, completionTokens: number): number {
  return Math.round(promptTokens * 0.1 + completionTokens * 0.5)
}

/** OpenAI reasoning_effort for stock vision (default none — fast/cheap). Override: STOCK_VISION_REASONING_EFFORT=low */
export function openAiStockVisionReasoningEffort(): 'none' | 'low' | 'medium' | 'high' {
  const raw = (process.env.STOCK_VISION_REASONING_EFFORT || 'none').trim().toLowerCase()
  if (raw === 'low' || raw === 'medium' || raw === 'high') return raw
  return 'none'
}

/**
 * Typical Luna cost for a full storyboard vision pass (cold cache).
 * 12 scenes × ≤5 thumbs, batched 8+4; ~9k prompt + ~300 completion tokens at low-detail images.
 */
export function typicalLunaStockVisionCostUsdMicros(sceneCount = 12): number {
  const batches = Math.ceil(sceneCount / 8)
  const thumbs = sceneCount * 5
  const promptTokens = thumbs * 85 + batches * 1200 + 800
  const completionTokens = sceneCount * 28
  return lunaTokenCostMicros(promptTokens, completionTokens)
}
