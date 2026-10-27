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

/** Social publish (TikTok / Shorts / Reels) — off until worker job + OAuth ship. */
export function isCompositionSocialPublishEnabled(): boolean {
  return process.env.FEATURE_COMPOSITION_SOCIAL_PUBLISH === '1'
}

/** Text-to-video product surfaces (P1–P20). Off unless FEATURE_T2V=1. */
export function isT2vFeatureEnabled(): boolean {
  const v = (process.env.FEATURE_T2V ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'on' || v === 'yes'
}
