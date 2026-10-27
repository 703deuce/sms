import { describe, expect, it } from 'vitest'
import { isElevenLabsModelUnsupportedError, ttsModelAttemptOrder } from '@/lib/server/ai/elevenlabs-tts'

describe('ttsModelAttemptOrder', () => {
  it('falls back from eleven_v4 to multilingual_v2', () => {
    expect(ttsModelAttemptOrder('eleven_v4')).toEqual(['eleven_v4', 'eleven_multilingual_v2'])
  })

  it('keeps flash as single attempt', () => {
    expect(ttsModelAttemptOrder('eleven_flash_v2_5')).toEqual(['eleven_flash_v2_5'])
  })
})

describe('isElevenLabsModelUnsupportedError', () => {
  it('detects model-related 422 errors', () => {
    expect(isElevenLabsModelUnsupportedError(new Error('elevenlabs_tts_422: model not found'))).toBe(true)
    expect(isElevenLabsModelUnsupportedError(new Error('rate limit'))).toBe(false)
  })
})
