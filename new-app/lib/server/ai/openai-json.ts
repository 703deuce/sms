import 'server-only'

import { getClipsLlmModelId } from '@/lib/server/ai/clips-llm'

const FALLBACK_MODEL = process.env.CLIPS_LLM_FALLBACK_MODEL?.trim() || 'gpt-4o-mini'

function retryableStatus(status: number, body: string): boolean {
  if (status === 429 || status === 503) return true
  const low = body.toLowerCase()
  return low.includes('heavy traffic') || low.includes('overloaded') || low.includes('rate limit')
}

async function callOnce(model: string, system: string, user: string): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  })
}

export async function openAiJsonResponse<T>(system: string, user: string): Promise<T> {
  const primary = getClipsLlmModelId()
  const models = [primary, FALLBACK_MODEL].filter((m, i, a) => a.indexOf(m) === i)
  let lastErr = ''

  for (const model of models) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await callOnce(model, system, user)
      const errText = res.ok ? '' : await res.text()
      if (!res.ok) {
        lastErr = `OpenAI API ${res.status}: ${errText.slice(0, 200)}`
        if (retryableStatus(res.status, errText) && attempt < 4) {
          await new Promise((r) => setTimeout(r, Math.min(8000, 500 * 2 ** attempt)))
          continue
        }
        break
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const content = json.choices?.[0]?.message?.content
      if (!content) throw new Error('OpenAI returned empty content')
      return JSON.parse(content) as T
    }
  }
  throw new Error(lastErr || 'OpenAI request failed')
}
