import 'server-only'
import { z } from 'zod'

const CLOUD_ENV_KEYS = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'] as const

const livekitTripleSchema = z.object({
  LIVEKIT_URL: z
    .string()
    .min(1)
    .refine((v) => v.startsWith('wss://') || v.startsWith('ws://'), {
      message: 'LIVEKIT_URL must be a WebSocket URL (wss://…)',
    }),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
})

export type RecordingLiveKitEnv = z.infer<typeof livekitTripleSchema>

/** Env var names used for clips recording — **LiveKit Cloud only** (never self-hosted). */
export function recordingLiveKitCloudEnvKeys(): readonly string[] {
  return CLOUD_ENV_KEYS
}

export function normalizeLiveKitWsUrl(raw: string): string {
  const t = raw.trim()
  if (t.startsWith('wss://') || t.startsWith('ws://')) return t
  if (t.startsWith('https://')) return `wss://${t.slice('https://'.length)}`
  if (t.startsWith('http://')) return `ws://${t.slice('http://'.length)}`
  return t
}

/**
 * LiveKit **Cloud** credentials for script recording / Rooms (M14–M16).
 * Reads only `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
 */
export function resolveRecordingLiveKitEnv(): RecordingLiveKitEnv {
  const url = process.env.LIVEKIT_URL?.trim()
  const parsed = livekitTripleSchema.safeParse({
    LIVEKIT_URL: url ? normalizeLiveKitWsUrl(url) : undefined,
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY?.trim(),
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET?.trim(),
  })
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => i.message).join('; ')
    throw new Error(
      `Recording LiveKit Cloud is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in Coolify. ${detail}`,
    )
  }
  return Object.freeze(parsed.data)
}

export function isRecordingLiveKitConfigured(): boolean {
  try {
    resolveRecordingLiveKitEnv()
    return true
  } catch {
    return false
  }
}
