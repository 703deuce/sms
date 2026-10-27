import 'server-only'
import {
  getRecordingLiveKitTarget,
  resolveRecordingLiveKitEnv,
  type RecordingLiveKitEnv,
} from '@/lib/server/livekit/recording-room-service'

export type LiveKitServerEnv = RecordingLiveKitEnv

let cached: LiveKitServerEnv | null = null
let cachedTarget: ReturnType<typeof getRecordingLiveKitTarget> | null = null

/** @internal tests only */
export function resetLiveKitEnvCache(): void {
  cached = null
  cachedTarget = null
}

/**
 * LiveKit credentials for **clips recording** (M14–M16), honoring `RECORDING_LIVEKIT_TARGET`.
 * Uses existing Coolify vars — Cloud: `LIVEKIT_*`; self-hosted: `LIVEKIT_SELF_HOSTED_*`.
 *
 * @see docs/clips/descript/livekit-api-brief.md
 * @see lib/server/livekit/recording-room-service.ts
 */
export function getLiveKitServerEnv(): LiveKitServerEnv {
  const target = getRecordingLiveKitTarget()
  if (cached && cachedTarget === target) return cached
  cached = resolveRecordingLiveKitEnv()
  cachedTarget = target
  return cached
}

/** Browser connects to the same WSS host as the active recording target (minted via server routes). */
export function getLiveKitPublicUrl(): string {
  return getLiveKitServerEnv().LIVEKIT_URL
}
