import 'server-only'
import { createHash } from 'node:crypto'
import { getElevenLabsApiKey } from '@/lib/server/ai/elevenlabs'
import type { T2vVoiceSettings } from '@/lib/t2v/types'

const BASE = 'https://api.elevenlabs.io'
const USD_PER_1K: Record<T2vVoiceSettings['modelId'], number> = {
  eleven_v4: 0.08,
  eleven_multilingual_v2: 0.08,
  eleven_v4_turbo: 0.04,
  eleven_flash_v2_5: 0.04,
}

export type TtsAlignment = {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}

export function ttsHash(text: string, v: T2vVoiceSettings): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        text.trim(),
        v.voiceId,
        v.modelId,
        v.stability,
        v.similarityBoost,
        v.style,
        v.speed,
        v.languageCode ?? '',
      ]),
    )
    .digest('hex')
}

/** Model order for /with-timestamps: prefer v4, fall back when the account rejects the model. */
export function ttsModelAttemptOrder(modelId: T2vVoiceSettings['modelId']): T2vVoiceSettings['modelId'][] {
  if (modelId === 'eleven_v4' || modelId === 'eleven_v4_turbo') {
    return [modelId, 'eleven_multilingual_v2']
  }
  return [modelId]
}

export function isElevenLabsModelUnsupportedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  const low = msg.toLowerCase()
  return (
    low.includes('model') &&
    (low.includes('not found') ||
      low.includes('unsupported') ||
      low.includes('invalid') ||
      low.includes('does not support') ||
      low.includes('elevenlabs_tts_422') ||
      low.includes('elevenlabs_tts_400'))
  )
}

async function ttsWithTimestampsOnce(input: {
  text: string
  voice: T2vVoiceSettings
  previousText?: string
  nextText?: string
  seed?: number
}): Promise<{
  audio: Buffer
  alignment: TtsAlignment
  usage: { provider: 'elevenlabs'; model: string; units: number; unitType: 'characters'; costUsdMicros: number }
}> {
  const key = getElevenLabsApiKey()
  const u = new URL(`${BASE}/v1/text-to-speech/${encodeURIComponent(input.voice.voiceId)}/with-timestamps`)
  u.searchParams.set('output_format', 'mp3_44100_128')
  const res = await fetch(u, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: input.text,
      model_id: input.voice.modelId,
      language_code: input.voice.languageCode,
      voice_settings: {
        stability: input.voice.stability,
        similarity_boost: input.voice.similarityBoost,
        style: input.voice.style,
        use_speaker_boost: true,
        speed: input.voice.speed,
      },
      previous_text: input.previousText,
      next_text: input.nextText,
      seed: input.seed,
    }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) {
    throw new Error(`elevenlabs_tts_${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  const body = (await res.json()) as {
    audio_base64: string
    alignment: TtsAlignment | null
    normalized_alignment: TtsAlignment | null
  }
  const alignment = body.alignment ?? body.normalized_alignment
  if (!alignment) throw new Error('elevenlabs_tts_no_alignment')
  const chars = input.text.length
  const model = input.voice.modelId
  return {
    audio: Buffer.from(body.audio_base64, 'base64'),
    alignment,
    usage: {
      provider: 'elevenlabs',
      model,
      units: chars,
      unitType: 'characters',
      costUsdMicros: Math.round((chars / 1000) * USD_PER_1K[model] * 1_000_000),
    },
  }
}

export async function ttsWithTimestamps(input: {
  text: string
  voice: T2vVoiceSettings
  previousText?: string
  nextText?: string
  seed?: number
}): Promise<{
  audio: Buffer
  alignment: TtsAlignment
  modelUsed: T2vVoiceSettings['modelId']
  usage: { provider: 'elevenlabs'; model: string; units: number; unitType: 'characters'; costUsdMicros: number }
}> {
  const order = ttsModelAttemptOrder(input.voice.modelId)
  let last: unknown
  for (const modelId of order) {
    try {
      const out = await ttsWithTimestampsOnce({ ...input, voice: { ...input.voice, modelId } })
      return { ...out, modelUsed: modelId }
    } catch (err) {
      last = err
      if (!isElevenLabsModelUnsupportedError(err) || modelId === order[order.length - 1]) {
        throw err
      }
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

export type VoiceListItem = {
  voiceId: string
  name: string
  previewUrl: string | null
  labels: Record<string, string>
  category?: string
}

export async function listVoices(q: {
  search?: string
  language?: string
  gender?: string
  accent?: string
  pageToken?: string
}) {
  const u = new URL(`${BASE}/v2/voices`)
  u.searchParams.set('page_size', '100')
  if (q.search) u.searchParams.set('search', q.search)
  if (q.language) u.searchParams.set('language', q.language)
  if (q.gender) u.searchParams.set('gender', q.gender)
  if (q.accent) u.searchParams.set('accent', q.accent)
  if (q.pageToken) u.searchParams.set('next_page_token', q.pageToken)
  const res = await fetch(u, {
    headers: { 'xi-api-key': getElevenLabsApiKey() },
    next: { revalidate: 3600 },
  } as RequestInit)
  if (!res.ok) throw new Error(`elevenlabs_voices_${res.status}`)
  const body = (await res.json()) as {
    voices: Array<{
      voice_id: string
      name?: string
      preview_url?: string | null
      labels?: Record<string, string>
      category?: string
    }>
    has_more: boolean
    next_page_token?: string | null
  }
  return {
    voices: body.voices.map(
      (v): VoiceListItem => ({
        voiceId: v.voice_id,
        name: v.name ?? v.voice_id,
        previewUrl: v.preview_url ?? null,
        labels: v.labels ?? {},
        category: v.category,
      }),
    ),
    nextPageToken: body.has_more ? body.next_page_token ?? null : null,
  }
}
