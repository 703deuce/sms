import 'server-only'
import {
  resolveRecordingLiveKitEnv,
  type RecordingLiveKitEnv,
} from '@/lib/server/livekit/recording-room-service'

export type LiveKitServerEnv = RecordingLiveKitEnv

let cached: LiveKitServerEnv | null = null

/** @internal tests only */
export function resetLiveKitEnvCache(): void {
  cached = null
}

/**
 * LiveKit **Cloud** credentials for clips recording (M14–M16).
 * Only `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
 *
 * @see docs/clips/descript/livekit-api-brief.md
 */
export function getLiveKitServerEnv(): LiveKitServerEnv {
  if (cached) return cached
  cached = resolveRecordingLiveKitEnv()
  return cached
}

/** Browser WSS host for recording rooms (minted via server token routes). */
export function getLiveKitPublicUrl(): string {
  return getLiveKitServerEnv().LIVEKIT_URL
}
