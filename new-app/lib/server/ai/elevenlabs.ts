import 'server-only'

export type ElevenLabsUsage = {
  provider: 'elevenlabs'
  model: string
  units: number
  unitType: 'seconds'
  costUsdMicros: number
}

export type ElevenLabsResult = {
  result: Buffer
  usage: ElevenLabsUsage
}

const MUSIC_COST_MICROS_PER_SEC = Math.round((0.15 / 60) * 1_000_000)
const SFX_COST_MICROS_PER_SEC = Math.round((0.12 / 60) * 1_000_000)

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

export function getElevenLabsApiKey(): string {
  const key =
    process.env.ELEVENLABS_API_KEY?.trim() ||
    process.env.ELEVENLABS_KEY?.trim() ||
    ''
  if (!key) throw new Error('ELEVENLABS_API_KEY is not configured')
  return key
}

type ElevenLabsErrorBody = {
  detail?: { status?: string; message?: string; data?: { prompt_suggestion?: string } }
}

function parseElevenLabsError(status: number, text: string): Error {
  let body: ElevenLabsErrorBody | null = null
  try {
    body = JSON.parse(text) as ElevenLabsErrorBody
  } catch {
    /* ignore */
  }
  const detail = body?.detail
  if (detail?.status === 'bad_prompt' && detail.data?.prompt_suggestion) {
    return new Error(`bad_prompt: ${detail.data.prompt_suggestion}`)
  }
  const msg = detail?.message || text.slice(0, 300) || `ElevenLabs HTTP ${status}`
  return new Error(msg)
}

export async function generateMusic(input: {
  prompt: string
  lengthMs: number
  instrumental: boolean
}): Promise<ElevenLabsResult> {
  const apiKey = getElevenLabsApiKey()
  const musicLengthMs = clamp(Math.round(input.lengthMs), 3000, 300_000)
  const url =
    'https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      accept: 'audio/mpeg',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      prompt: String(input.prompt || '').slice(0, 4000),
      music_length_ms: musicLengthMs,
      model_id: 'music_v1',
      force_instrumental: Boolean(input.instrumental),
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw parseElevenLabsError(res.status, text)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const seconds = musicLengthMs / 1000
  return {
    result: buf,
    usage: {
      provider: 'elevenlabs',
      model: 'music_v1',
      units: seconds,
      unitType: 'seconds',
      costUsdMicros: Math.round(seconds * MUSIC_COST_MICROS_PER_SEC),
    },
  }
}

export async function generateSfx(input: {
  text: string
  durationSec: number
}): Promise<ElevenLabsResult> {
  const apiKey = getElevenLabsApiKey()
  const durationSeconds = clamp(Number(input.durationSec), 0.5, 5)
  const url =
    'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      accept: 'audio/mpeg',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      text: String(input.text || '').slice(0, 500),
      duration_seconds: durationSeconds,
      prompt_influence: 0.4,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw parseElevenLabsError(res.status, text)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  return {
    result: buf,
    usage: {
      provider: 'elevenlabs',
      model: 'sound_generation',
      units: durationSeconds,
      unitType: 'seconds',
      costUsdMicros: Math.round(durationSeconds * SFX_COST_MICROS_PER_SEC),
    },
  }
}
