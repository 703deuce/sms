import { describe, expect, it, vi } from 'vitest'
import { adVoiceSettings } from '@/lib/ad-studio/voice'
import { DEFAULT_T2V_VOICE } from '@/lib/t2v/voice-defaults'
describe('Ad Studio B3d voice choice', () => {
  it('defaults to George and honors an optional voice id', () => {
    expect(adVoiceSettings()).toEqual(DEFAULT_T2V_VOICE)
    expect(adVoiceSettings('custom-voice-123').voiceId).toBe('custom-voice-123')
    expect(adVoiceSettings('custom-voice-123').modelId).toBe(DEFAULT_T2V_VOICE.modelId)
  })
})
