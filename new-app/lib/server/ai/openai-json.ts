import 'server-only'

import { getClipsLlmModelId } from '@/lib/server/ai/clips-llm'
import {
  clipsEditorJsonWithGeminiFallback,
  logOpenAiErrorResponse,
  openAiChatJson,
} from '@/lib/server/ai/clips-editor-llm'
import { gpt6ChatCompletionExtras, isGpt6FamilyModel } from '@/lib/server/ai/gpt-6-luna-chat'

const FALLBACK_MODEL = process.env.CLIPS_LLM_FALLBACK_MODEL?.trim() || 'gpt-4o-mini'

function retryableStatus(status: number, body: string): boolean {
  if (status === 429 || status === 503) return true
  const low = body.toLowerCase()
  return low.includes('heavy traffic') || low.includes('overloaded') || low.includes('rate limit')
}

async function callOnce(model: string, system: string, user: string): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  const tokenField = isGpt6FamilyModel(model)
    ? { max_completion_tokens: 512 }
    : { max_tokens: 512 }
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
      ...tokenField,
      ...gpt6ChatCompletionExtras(model),
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
        await logOpenAiErrorResponse('openai_json', res.status, errText)
        lastErr = `Could not complete AI request (${res.status})`
        if (retryableStatus(res.status, errText) && attempt < 4) {
          await new Promise((r) => setTimeout(r, Math.min(8000, 500 * 2 ** attempt)))
          continue
        }
        break
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const content = json.choices?.[0]?.message?.content
      if (!content) throw new Error('AI returned an empty response')
      return JSON.parse(content) as T
    }
  }
  throw new Error(lastErr || 'AI request failed')
}

export async function openAiJsonWithGeminiFallback<T>(
  context: string,
  system: string,
  user: string,
  responseSchema: Record<string, unknown>,
): Promise<T> {
  const llm = await clipsEditorJsonWithGeminiFallback<T>({
    context,
    system,
    user,
    responseSchema,
  })
  return llm.data
}

export { openAiChatJson, clipsEditorJsonWithGeminiFallback }
