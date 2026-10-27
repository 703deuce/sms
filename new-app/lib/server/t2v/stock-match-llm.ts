import 'server-only'
import { openAiJsonResponse } from '@/lib/server/ai/openai-json'
import { logT2v } from '@/lib/server/t2v/log'
import type { StockCandidate } from '@/lib/server/t2v/stock-match'

/** Cheap LLM tie-breaker among top stock candidates (tags only, no URLs). */
export async function llmPickStockIndex(input: {
  videoTopic: string
  sceneVisual: string
  narrationSnippet: string
  candidates: StockCandidate[]
}): Promise<number | null> {
  if (!process.env.OPENAI_API_KEY?.trim()) return null
  const top = input.candidates.slice(0, 5)
  if (top.length <= 1) return 0
  const system =
    'Pick the stock b-roll clip that best matches the video topic and scene visual. ' +
    'Reply with JSON only: {"idx": number} where idx is the option index.'
  const user = JSON.stringify({
    videoTopic: input.videoTopic.slice(0, 200),
    sceneVisual: input.sceneVisual.slice(0, 300),
    narration: input.narrationSnippet.slice(0, 200),
    options: top.map((c, i) => ({
      idx: i,
      provider: c.provider,
      tags: c.tags.slice(0, 20),
    })),
  })
  try {
    const out = await openAiJsonResponse<{ idx: number }>(system, user)
    if (typeof out.idx === 'number' && out.idx >= 0 && out.idx < top.length) {
      logT2v('stock-match', 'llm pick', { idx: out.idx, poolSize: top.length })
      return out.idx
    }
  } catch (err) {
    logT2v('stock-match', 'llm pick skipped', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
  return null
}
