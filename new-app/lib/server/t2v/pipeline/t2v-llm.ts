import 'server-only'

import { getClipsLlmModelId } from '@/lib/server/ai/clips-llm'
import { gpt6ChatCompletionExtras, isGpt6FamilyModel } from '@/lib/server/ai/gpt-6-luna-chat'

/**
 * Prompt-to-Video's own JSON LLM call. The shared openAiJsonResponse caps output at 512 tokens, which
 * truncates a 90s+ story/script/scene plan mid-JSON. This copy is T2V-only: larger output budget, one
 * call per agent, a single wait-and-retry only on 429/503 (unbilled), and a clear error on truncation.
 */
const T2V_LLM_MAX_OUTPUT_TOKENS = 8000

export async function t2vLlmJson<T>(system: string, user: string, opts?: { maxTokens?: number }): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  const model = getClipsLlmModelId()
  const maxTokens = opts?.maxTokens ?? T2V_LLM_MAX_OUTPUT_TOKENS
  const tokenField = isGpt6FamilyModel(model) ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        ...tokenField,
        ...gpt6ChatCompletionExtras(model),
      }),
      signal: AbortSignal.timeout(180_000),
    })
    if (!res.ok) {
      if ((res.status === 429 || res.status === 503) && attempt === 0) {
        await new Promise((r) => setTimeout(r, 4000))
        continue
      }
      throw new Error(`t2v_llm_http_${res.status}`)
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> }
    const choice = json.choices?.[0]
    const content = choice?.message?.content
    if (!content) throw new Error('t2v_llm_empty_response')
    if (choice?.finish_reason === 'length') throw new Error('t2v_llm_output_truncated')
    return JSON.parse(content) as T
  }
  throw new Error('t2v_llm_unavailable')
}
