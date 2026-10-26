import { describe, expect, it } from 'vitest'
import {
  buildWanVideoTaskBody,
  signGenerationCallback,
  verifyGenerationCallback,
} from '@/lib/clips/kie-task'

describe('kie client', () => {
  it('builds createTask body for wan 3.0', () => {
    const body = buildWanVideoTaskBody({
      prompt: 'Cinematic rain on glass',
      durationS: 4,
      resolution: '480p',
      callBackUrl: 'https://example.com/cb',
    })
    expect(body.model).toBe('wan/3-0-video')
    expect(body.input.aspect_ratio).toBe('9:16')
    expect(body.input.duration).toBe(4)
    expect(body.input.resolution).toBe('480P')
  })

  it('verifies callback hmac', () => {
    process.env.KIE_CALLBACK_SECRET = 'test-secret'
    const sig = signGenerationCallback('gen_123', 'test-secret')
    expect(verifyGenerationCallback('gen_123', sig, 'test-secret')).toBe(true)
    expect(verifyGenerationCallback('gen_123', 'deadbeef', 'test-secret')).toBe(false)
  })
})
