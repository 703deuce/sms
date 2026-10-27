import 'server-only'
import { z } from 'zod'

const livekitEnvSchema = z.object({
  LIVEKIT_URL: z
    .string()
    .min(1, 'LIVEKIT_URL is required (wss://<project>.livekit.cloud)')
    .refine((v) => v.startsWith('wss://') || v.startsWith('ws://'), {
      message: 'LIVEKIT_URL must be a WebSocket URL (wss://…)',
    }),
  LIVEKIT_API_KEY: z.string().min(1, 'LIVEKIT_API_KEY is required'),
  LIVEKIT_API_SECRET: z.string().min(1, 'LIVEKIT_API_SECRET is required'),
})

export type LiveKitServerEnv = z.infer<typeof livekitEnvSchema>

let cached: LiveKitServerEnv | null = null

/** @internal tests only */
export function resetLiveKitEnvCache(): void {
  cached = null
}

/**
 * Validated LiveKit Cloud credentials (server-only).
 * Call from recording route handlers at **M14+** — not at app boot, so the editor can run before keys exist.
 *
 * @see docs/clips/descript/livekit-api-brief.md §1
 */
export function getLiveKitServerEnv(): LiveKitServerEnv {
  if (cached) return cached
  const parsed = livekitEnvSchema.safeParse({
    LIVEKIT_URL: process.env.LIVEKIT_URL?.trim(),
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY?.trim(),
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET?.trim(),
  })
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => i.message).join('; ')
    throw new Error(
      `LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in Coolify before enabling recording (M14). ${detail}`,
    )
  }
  cached = Object.freeze(parsed.data)
  return cached
}

/** Browser-safe project URL (not a secret). */
export function getLiveKitPublicUrl(): string {
  const fromPublic = process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim()
  if (fromPublic) return fromPublic
  try {
    return getLiveKitServerEnv().LIVEKIT_URL
  } catch {
    throw new Error(
      'LiveKit is not configured. Set NEXT_PUBLIC_LIVEKIT_URL (or LIVEKIT_URL on the server) before opening the recorder.',
    )
  }
}
