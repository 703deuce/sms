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
  // Default after prod probe: Luna when OpenAI is configured, else Gemini Flash-Lite.
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai-luna'
  if (geminiVisionConfigured()) return 'gemini-flash-lite'
  return null
}

export function openAiStockVisionModelId(): string {
  const raw = (process.env.STOCK_VISION_MODEL || '').trim()
  if (raw.startsWith('gpt-')) return raw
  return LUNA_MODEL_ID
}

export function lunaTokenCostMicros(promptTokens: number, completionTokens: number): number {
  return Math.round(promptTokens * 0.1 + completionTokens * 0.5)
}
