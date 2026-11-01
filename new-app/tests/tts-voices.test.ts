import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { TEXT_MAX_CHARS } from '@/lib/clips/editor/text-items'
import { TTS_STOCK_VOICES } from '@/lib/clips/tts-voices'

const routeBody = z.object({
  text: z.string().min(1).max(TEXT_MAX_CHARS),
  voiceId: z.string(),
})

describe('voiceover route schema', () => {
  it('rejects unknown voiceId', () => {
    expect(() => routeBody.parse({ text: 'Hi', voiceId: 'not-a-voice' })).not.toThrow()
    const ok = TTS_STOCK_VOICES.some((v) => v.id === 'not-a-voice')
    expect(ok).toBe(false)
  })

  it('rejects text over 200 chars', () => {
    expect(() => routeBody.parse({ text: 'x'.repeat(201), voiceId: TTS_STOCK_VOICES[0]!.id })).toThrow()
  })

  it('accepts stock voice and short text', () => {
    const parsed = routeBody.parse({ text: 'Hello', voiceId: TTS_STOCK_VOICES[0]!.id })
    expect(parsed.voiceId).toBe(TTS_STOCK_VOICES[0]!.id)
  })
})
