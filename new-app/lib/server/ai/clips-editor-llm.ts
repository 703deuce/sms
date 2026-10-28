import 'server-only'

import { getClipsLlmModelId } from '@/lib/server/ai/clips-llm'
import { discoverVisionFlashLiteModel, geminiGenerateJson, geminiVisionTokenCostMicros } from '@/lib/server/ai/gemini-flash-lite'
import { gpt6ChatCompletionExtras, isGpt6FamilyModel } from '@/lib/server/ai/gpt-6-luna-chat'

export type ClipsEditorLlmResult<T> = {
  data: T
  provider: 'openai' | 'gemini'
  model: string
  promptTokens: number
  completionTokens: number
}

function openAiTokenFields(model: string, maxOut: number): Record<string, number> {
  if (isGpt6FamilyModel(model)) {
    return { max_completion_tokens: maxOut }
  }
  return { max_tokens: maxOut }
}

export async function logOpenAiErrorResponse(context: string, status: number, bodyText: string): Promise<void> {
  try {
    const parsed = JSON.parse(bodyText) as { error?: { message?: string; param?: string; type?: string } }
    const err = parsed.error
    if (err?.message || err?.param) {
      console.warn(`[clipper:editor-llm] ${context} openai_error`, {
        status,
        message: err.message?.slice(0, 400),
        param: err.param ?? null,
        type: err.type ?? null,
      })
      return
    }
  } catch {
    /* ignore */
  }
  console.warn(`[clipper:editor-llm] ${context} openai_error`, { status, bodyPreview: bodyText.slice(0, 200) })
}

export async function openAiChatJson<T>(opts: {
  context: string
  system: string
  user: string
  maxOutputTokens?: number
  temperature?: number
}): Promise<{ data: T; model: string; promptTokens: number; completionTokens: number }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  const model = getClipsLlmModelId()
  const maxOut = opts.maxOutputTokens ?? (isGpt6FamilyModel(model) ? 512 : 256)
  const extras = gpt6ChatCompletionExtras(model)
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      ...openAiTokenFields(model, maxOut),
      ...extras,
    }),
    signal: AbortSignal.timeout(60_000),
  })
  const errText = res.ok ? '' : await res.text()
  if (!res.ok) {
    await logOpenAiErrorResponse(opts.context, res.status, errText)
    throw new Error(`Could not complete AI request (${res.status})`)
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new Error('AI returned an empty response')
  return {
    data: JSON.parse(content) as T,
    model,
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
  }
}

export async function clipsEditorJsonWithGeminiFallback<T>(opts: {
  context: string
  system: string
  user: string
  responseSchema: Record<string, unknown>
  maxOutputTokens?: number
}): Promise<ClipsEditorLlmResult<T>> {
  try {
    const oa = await openAiChatJson<T>({
      context: opts.context,
      system: opts.system,
      user: opts.user,
      maxOutputTokens: opts.maxOutputTokens,
    })
    return {
      data: oa.data,
      provider: 'openai',
      model: oa.model,
      promptTokens: oa.promptTokens,
      completionTokens: oa.completionTokens,
    }
  } catch (primaryErr) {
    console.warn(`[clipper:editor-llm] ${opts.context} gemini_fallback`, {
      error: primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
    })
    const model = await discoverVisionFlashLiteModel()
    const { text, promptTokens, outputTokens } = await geminiGenerateJson({
      model,
      parts: [{ text: `${opts.system}\n\n${opts.user}` }],
      responseSchema: opts.responseSchema,
      temperature: 0.35,
      timeoutMs: 90_000,
    })
    return {
      data: JSON.parse(text) as T,
      provider: 'gemini',
      model,
      promptTokens,
      completionTokens: outputTokens,
    }
  }
}

export function clipsEditorLlmCostMicros(
  provider: 'openai' | 'gemini',
  promptTokens: number,
  completionTokens: number,
): number {
  if (provider === 'gemini') return geminiVisionTokenCostMicros(promptTokens, completionTokens)
  return Math.round(promptTokens * 100_000 + completionTokens * 500_000)
}
