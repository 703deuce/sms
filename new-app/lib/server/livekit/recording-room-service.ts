import 'server-only'
import { z } from 'zod'

export type RecordingLiveKitTarget = 'cloud' | 'self_hosted'

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

const SELF_HOSTED_WSS_DEFAULT = 'wss://voice.transovo.ai'

/** `RECORDING_LIVEKIT_TARGET=cloud|self_hosted` (default **cloud**). Clips recording only — does not change voice worker `MEDIA_BACKEND_MODE`. */
export function getRecordingLiveKitTarget(): RecordingLiveKitTarget {
  const raw = (process.env.RECORDING_LIVEKIT_TARGET ?? 'cloud').trim().toLowerCase().replace(/-/g, '_')
  if (raw === 'self_hosted' || raw === 'selfhosted') return 'self_hosted'
  return 'cloud'
}

export function normalizeLiveKitWsUrl(raw: string): string {
  const t = raw.trim()
  if (t.startsWith('wss://') || t.startsWith('ws://')) return t
  if (t.startsWith('https://')) return `wss://${t.slice('https://'.length)}`
  if (t.startsWith('http://')) return `ws://${t.slice('http://'.length)}`
  return t
}

function readTriple(
  urlKey: string,
  keyKey: string,
  secretKey: string,
  urlFallback?: string,
): { url?: string; key?: string; secret?: string } {
  const url = (process.env[urlKey]?.trim() || urlFallback || '').trim()
  return {
    url: url ? normalizeLiveKitWsUrl(url) : undefined,
    key: process.env[keyKey]?.trim(),
    secret: process.env[secretKey]?.trim(),
  }
}

/** Resolve Coolify LiveKit credentials for script recording / Rooms (M14–M16). */
export function resolveRecordingLiveKitEnv(): RecordingLiveKitEnv {
  const target = getRecordingLiveKitTarget()
  const triple =
    target === 'self_hosted'
      ? readTriple(
          'LIVEKIT_SELF_HOSTED_URL',
          'LIVEKIT_SELF_HOSTED_API_KEY',
          'LIVEKIT_SELF_HOSTED_API_SECRET',
          SELF_HOSTED_WSS_DEFAULT,
        )
      : readTriple('LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET')

  const parsed = livekitTripleSchema.safeParse({
    LIVEKIT_URL: triple.url,
    LIVEKIT_API_KEY: triple.key,
    LIVEKIT_API_SECRET: triple.secret,
  })
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => i.message).join('; ')
    const which =
      target === 'self_hosted'
        ? 'LIVEKIT_SELF_HOSTED_URL, LIVEKIT_SELF_HOSTED_API_KEY, LIVEKIT_SELF_HOSTED_API_SECRET'
        : 'LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET'
    throw new Error(
      `Recording LiveKit (${target}) is not configured. Set ${which} in Coolify. ${detail}`,
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
