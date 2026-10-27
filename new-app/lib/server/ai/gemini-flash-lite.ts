import 'server-only'

/** Aligns with worker/clips_worker/gemini_vision.py discover_model (do not edit that file). */
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export function geminiApiKey(): string {
  const key =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GEMINI_API_KEY?.trim() || ''
  if (!key) throw new Error('GEMINI_API_KEY is not configured')
  return key
}

export function geminiVisionConfigured(): boolean {
  return Boolean(
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GEMINI_API_KEY?.trim(),
  )
}

/** VISION_MODEL override, else newest flash-lite with generateContent (same rule as gemini_vision.py). */
export async function discoverVisionFlashLiteModel(): Promise<string> {
  const configured = process.env.VISION_MODEL?.trim()
  if (configured) return configured

  const key = geminiApiKey()
  const res = await fetch(`${GEMINI_BASE}/models?key=${encodeURIComponent(key)}`, {
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Gemini models list failed (${res.status})`)
  const body = (await res.json()) as {
    models?: { name?: string; supportedGenerationMethods?: string[] }[]
  }
  const candidates: string[] = []
  for (const m of body.models ?? []) {
    const name = String(m.name ?? '').replace(/^models\//, '')
    const methods = m.supportedGenerationMethods ?? []
    if (name.toLowerCase().includes('flash-lite') && methods.includes('generateContent')) {
      candidates.push(name)
    }
  }
  if (!candidates.length) throw new Error('no gemini flash-lite model found')
  return candidates.sort()[candidates.length - 1]
}

/** Flash-lite list pricing used elsewhere in new-app (per 1M tokens). */
export function geminiVisionTokenCostMicros(promptTokens: number, outputTokens: number): number {
  const inMicros = (promptTokens / 1_000_000) * 0.25 * 1_000_000
  const outMicros = (outputTokens / 1_000_000) * 1.5 * 1_000_000
  return Math.round(inMicros + outMicros)
}

export type GeminiContentPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }

export async function geminiGenerateJson(input: {
  model: string
  parts: GeminiContentPart[]
  responseSchema: Record<string, unknown>
  temperature?: number
  timeoutMs?: number
}): Promise<{ text: string; promptTokens: number; outputTokens: number }> {
  const key = geminiApiKey()
  const res = await fetch(
    `${GEMINI_BASE}/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: input.parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: input.responseSchema,
          temperature: input.temperature ?? 0.3,
        },
      }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 60_000),
    },
  )
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Gemini generateContent failed (${res.status}): ${t.slice(0, 200)}`)
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  }
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned empty content')
  return {
    text,
    promptTokens: Number(json.usageMetadata?.promptTokenCount || 0),
    outputTokens: Number(json.usageMetadata?.candidatesTokenCount || 0),
  }
}
