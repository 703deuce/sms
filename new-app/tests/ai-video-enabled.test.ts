import { describe, expect, it } from 'vitest'
import { isAiVideoEnabledFromEnv } from '@/lib/features/ai-video-enabled'

describe('isAiVideoEnabledFromEnv', () => {
  it('is off by default', () => {
    expect(isAiVideoEnabledFromEnv({})).toBe(false)
  })

  it('enables on NEXT_PUBLIC_AI_VIDEO_ENABLED', () => {
    expect(isAiVideoEnabledFromEnv({ NEXT_PUBLIC_AI_VIDEO_ENABLED: 'true' })).toBe(true)
  })

  it('enables on AI_VIDEO_ENABLED server env', () => {
    expect(isAiVideoEnabledFromEnv({ AI_VIDEO_ENABLED: '1' })).toBe(true)
  })

  it('supports legacy FEATURE_T2V', () => {
    expect(isAiVideoEnabledFromEnv({ FEATURE_T2V: 'on' })).toBe(true)
  })
})
