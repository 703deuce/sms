const TRUTHY = new Set(['1', 'true', 'on', 'yes'])

/** Parse AI Video feature flag (default off). Supports legacy FEATURE_T2V aliases. */
export function isAiVideoEnabledFromEnv(env: {
  NEXT_PUBLIC_AI_VIDEO_ENABLED?: string
  AI_VIDEO_ENABLED?: string
  NEXT_PUBLIC_FEATURE_T2V?: string
  FEATURE_T2V?: string
}): boolean {
  const candidates = [
    env.NEXT_PUBLIC_AI_VIDEO_ENABLED,
    env.AI_VIDEO_ENABLED,
    env.NEXT_PUBLIC_FEATURE_T2V,
    env.FEATURE_T2V,
  ]
  for (const raw of candidates) {
    const v = (raw ?? '').trim().toLowerCase()
    if (TRUTHY.has(v)) return true
  }
  return false
}
