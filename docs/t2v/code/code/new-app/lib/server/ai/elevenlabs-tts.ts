import 'server-only'
import { createHash } from 'node:crypto'
import { getElevenLabsApiKey } from '@/lib/server/ai/elevenlabs'
import type { T2vVoiceSettings } from '@/lib/t2v/types'

/**
 * ElevenLabs TTS with character timestamps (official API reference):
 *   POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_128
 *   headers: xi-api-key, Content-Type: application/json
 *   body: { text, model_id, voice_settings:{stability,similarity_boost,style,use_speaker_boost,speed},
 *           language_code?, seed?, previous_text?, next_text?, apply_text_normalization? }
 *   200: { audio_base64, alignment:{characters[],character_start_times_seconds[],character_end_times_seconds[]},
 *          normalized_alignment:{...} }
 * Voices: GET https://api.elevenlabs.io/v2/voices?search=&page_size<=100&category=&language=&gender=&accent=
 *   -> voices[{voice_id,name,labels,preview_url,category,verified_languages}], has_more, next_page_token
 * Pricing (elevenlabs.io/pricing/api, read 2026-10-27): v4 / v3 / Multilingual v2 = $0.08 per 1K chars;
 *   v4 Turbo / Flash = $0.04 per 1K chars. Character limits: v4 10k, Flash v2.5 40k.
 * NOTE: AiUsage costing below assumes those prices; ElevenLabs bills per character.
 */
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
    .update(JSON.stringify([text.trim(), v.voiceId, v.modelId, v.stability, v.similarityBoost, v.style, v.speed, v.languageCode ?? '']))
    .digest('hex')
}

export async function ttsWithTimestamps(input: {
  text: string
  voice: T2vVoiceSettings
  previousText?: string
  nextText?: string
  seed?: number
}): Promise<{ audio: Buffer; alignment: TtsAlignment; usage: { provider: 'elevenlabs'; model: string; units: number; unitType: 'characters'; costUsdMicros: number } }> {
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
      // Neighbouring scene text keeps prosody continuous across per-scene requests.
      previous_text: input.previousText,
      next_text: input.nextText,
      seed: input.seed,
    }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`elevenlabs_tts_${res.status}: ${(await res.text()).slice(0, 200)}`)
  const body = (await res.json()) as { audio_base64: string; alignment: TtsAlignment | null; normalized_alignment: TtsAlignment | null }
  const alignment = body.alignment ?? body.normalized_alignment
  if (!alignment) throw new Error('elevenlabs_tts_no_alignment')
  const chars = input.text.length
  return {
    audio: Buffer.from(body.audio_base64, 'base64'),
    alignment,
    usage: { provider: 'elevenlabs', model: input.voice.modelId, units: chars, unitType: 'characters', costUsdMicros: Math.round((chars / 1000) * USD_PER_1K[input.voice.modelId] * 1_000_000) },
  }
}

export type VoiceListItem = { voiceId: string; name: string; previewUrl: string | null; labels: Record<string, string>; category?: string }

export async function listVoices(q: { search?: string; language?: string; gender?: string; accent?: string; pageToken?: string }) {
  const u = new URL(`${BASE}/v2/voices`)
  u.searchParams.set('page_size', '100')
  if (q.search) u.searchParams.set('search', q.search)
  if (q.language) u.searchParams.set('language', q.language)
  if (q.gender) u.searchParams.set('gender', q.gender)
  if (q.accent) u.searchParams.set('accent', q.accent)
  if (q.pageToken) u.searchParams.set('next_page_token', q.pageToken)
  const res = await fetch(u, { headers: { 'xi-api-key': getElevenLabsApiKey() }, next: { revalidate: 3600 } } as RequestInit)
  if (!res.ok) throw new Error(`elevenlabs_voices_${res.status}`)
  const body = (await res.json()) as { voices: Array<{ voice_id: string; name?: string; preview_url?: string | null; labels?: Record<string, string>; category?: string }>; has_more: boolean; next_page_token?: string | null }
  return {
    voices: body.voices.map((v): VoiceListItem => ({ voiceId: v.voice_id, name: v.name ?? v.voice_id, previewUrl: v.preview_url ?? null, labels: v.labels ?? {}, category: v.category })),
    nextPageToken: body.has_more ? body.next_page_token ?? null : null,
  }
}

/** Instant voice clone (M6, consent checkbox required): POST /v1/voices/add multipart {name, files[], remove_background_noise?} -> {voice_id, requires_verification}. */
export async function cloneVoice(name: string, files: Blob[], removeBackgroundNoise = false) {
  const form = new FormData()
  form.append('name', name)
  for (const f of files) form.append('files', f, 'sample.mp3')
  if (removeBackgroundNoise) form.append('remove_background_noise', 'true')
  const res = await fetch(`${BASE}/v1/voices/add`, { method: 'POST', headers: { 'xi-api-key': getElevenLabsApiKey() }, body: form })
  if (!res.ok) throw new Error(`elevenlabs_clone_${res.status}`)
  return (await res.json()) as { voice_id: string; requires_verification: boolean }
}
