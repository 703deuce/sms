import 'server-only'

/**
 * Non-throwing gates for optional product areas. See docs/clips/BLOCKED.md.
 */
export function isLiveKitConfigured(): boolean {
  const url = process.env.LIVEKIT_URL?.trim()
  const key = process.env.LIVEKIT_API_KEY?.trim()
  const secret = process.env.LIVEKIT_API_SECRET?.trim()
  return Boolean(url && key && secret && (url.startsWith('wss://') || url.startsWith('ws://')))
}

/** When set to `0`, hide recording/Rooms entry points even if LiveKit env is present. */
export function isRecordingFeatureEnabled(): boolean {
  if (process.env.FEATURE_SCRIPT_RECORDING === '0') return false
  return isLiveKitConfigured()
}
