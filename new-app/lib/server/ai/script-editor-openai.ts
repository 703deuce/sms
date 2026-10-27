import 'server-only'

import { CLIPS_LLM_MODEL_ID } from '@/lib/server/ai/clips-llm'
import { gpt6ChatCompletionExtras, isGpt6FamilyModel } from '@/lib/server/ai/gpt-6-luna-chat'
import { logEditor } from '@/lib/server/clips/script-editor-log'

const SCRIPT_EDITOR_MODEL =
  process.env.SCRIPT_EDITOR_LLM_MODEL?.trim() ||
  process.env.CLIP_LLM_MODEL?.trim() ||
  CLIPS_LLM_MODEL_ID

function retryableStatus(status: number, body: string): boolean {
  if (status === 429 || status === 503) return true
  const low = body.toLowerCase()
  return low.includes('heavy traffic') || low.includes('overloaded') || low.includes('rate limit')
}

async function callOnce(
  model: string,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  json: boolean,
): Promise<Response> {
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
      ...gpt6ChatCompletionExtras(model),
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      messages,
    }),
    signal: AbortSignal.timeout(60_000),
  })
}

/** Descript-style composition AI (clarity, chapters, retakes, music suggest) — gpt-6-luna. */
export async function scriptEditorOpenAiJson<T>(system: string, user: string): Promise<T> {
  const model = SCRIPT_EDITOR_MODEL
  const started = Date.now()
  let lastErr = ''

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await callOnce(model, [{ role: 'system', content: system }, { role: 'user', content: user }], true)
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
    logEditor('ai', 'json ok', { model, latencyMs: Date.now() - started, gpt6: isGpt6FamilyModel(model) })
    return JSON.parse(content) as T
  }
  logEditor('ai', 'json failed', { model, error: lastErr.slice(0, 120) })
  throw new Error(lastErr || 'OpenAI request failed')
}

export async function scriptEditorOpenAiText(system: string, user: string): Promise<{ text: string; model: string }> {
  const model = SCRIPT_EDITOR_MODEL
  const started = Date.now()
  let lastErr = ''

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await callOnce(model, [{ role: 'system', content: system }, { role: 'user', content: user }], false)
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
    const text = json.choices?.[0]?.message?.content?.trim() || ''
    logEditor('ai', 'text ok', { model, latencyMs: Date.now() - started, gpt6: isGpt6FamilyModel(model) })
    return { text, model }
  }
  logEditor('ai', 'text failed', { model, error: lastErr.slice(0, 120) })
  throw new Error(lastErr || 'OpenAI request failed')
}
