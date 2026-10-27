import { isAiVideoEnabledFromEnv } from '@/lib/features/ai-video-enabled'

/** Client + shared bundle: NEXT_PUBLIC_AI_VIDEO_ENABLED (default off). Legacy: NEXT_PUBLIC_FEATURE_T2V. */
export function isT2vFeatureEnabled(): boolean {
  return isAiVideoEnabledFromEnv({
    NEXT_PUBLIC_AI_VIDEO_ENABLED: process.env.NEXT_PUBLIC_AI_VIDEO_ENABLED,
    NEXT_PUBLIC_FEATURE_T2V: process.env.NEXT_PUBLIC_FEATURE_T2V,
    FEATURE_T2V: process.env.FEATURE_T2V,
    AI_VIDEO_ENABLED: process.env.AI_VIDEO_ENABLED,
  })
}
