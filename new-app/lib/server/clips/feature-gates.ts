import 'server-only'
import { isAiVideoEnabledFromEnv } from '@/lib/features/ai-video-enabled'
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

/** Text-to-video product surfaces. Off unless AI_VIDEO_ENABLED / NEXT_PUBLIC_AI_VIDEO_ENABLED (or legacy FEATURE_T2V). */
export function isT2vFeatureEnabled(): boolean {
  return isAiVideoEnabledFromEnv({
    AI_VIDEO_ENABLED: process.env.AI_VIDEO_ENABLED,
    NEXT_PUBLIC_AI_VIDEO_ENABLED: process.env.NEXT_PUBLIC_AI_VIDEO_ENABLED,
    FEATURE_T2V: process.env.FEATURE_T2V,
    NEXT_PUBLIC_FEATURE_T2V: process.env.NEXT_PUBLIC_FEATURE_T2V,
  })
}
