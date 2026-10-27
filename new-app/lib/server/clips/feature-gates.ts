import 'server-only'
import { isAiVideoEnabledFromEnv } from '@/lib/features/ai-video-enabled'
import { isScriptEditorEnabledFromEnv } from '@/lib/features/script-editor-enabled'
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

/** Full Descript-style `/script` editor product. Off unless SCRIPT_EDITOR_ENABLED (Rick launch default). */
export function isScriptEditorFeatureEnabled(): boolean {
  return isScriptEditorEnabledFromEnv({
    SCRIPT_EDITOR_ENABLED: process.env.SCRIPT_EDITOR_ENABLED,
    NEXT_PUBLIC_SCRIPT_EDITOR_ENABLED: process.env.NEXT_PUBLIC_SCRIPT_EDITOR_ENABLED,
  })
}

/** Screenwriting nav + pages require script editor launch flag (env gate alone is not enough). */
export function isScreenwritingProductEnabled(): boolean {
  if (!isScriptEditorFeatureEnabled()) return false
  const v = (
    process.env.FEATURE_SCREENWRITING ??
    process.env.NEXT_PUBLIC_FEATURE_SCREENWRITING ??
    ''
  )
    .trim()
    .toLowerCase()
  return v === '1' || v === 'true' || v === 'on' || v === 'yes'
}
