import 'server-only'
import { isRecordingLiveKitConfigured } from '@/lib/server/livekit/recording-room-service'

/** @deprecated use isRecordingLiveKitConfigured */
export function isLiveKitConfigured(): boolean {
  return isRecordingLiveKitConfigured()
}

/** When set to `0`, hide recording/Rooms entry points even if LiveKit env is present. */
export function isRecordingFeatureEnabled(): boolean {
  if (process.env.FEATURE_SCRIPT_RECORDING === '0') return false
  return isRecordingLiveKitConfigured()
}
