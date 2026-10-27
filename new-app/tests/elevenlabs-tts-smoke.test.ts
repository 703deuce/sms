import { describe, expect, it } from 'vitest'
import { listVoices, ttsWithTimestamps } from '@/lib/server/ai/elevenlabs-tts'
import { durationMsFromAlignment, wordsFromAlignment } from '@/lib/server/t2v/tts-alignment'
import { DEFAULT_T2V_VOICE } from '@/lib/t2v/voice-defaults'

const keyed = Boolean(
  process.env.ELEVENLABS_API_KEY?.trim() || process.env.ELEVENLABS_KEY?.trim(),
)

describe.skipIf(!keyed)('elevenlabs TTS smoke (live)', () => {
  it('with-timestamps on eleven_v4 or falls back to eleven_multilingual_v2', async () => {
    const text = 'Solar panels turn sunlight into electricity.'
    const out = await ttsWithTimestamps({ text, voice: DEFAULT_T2V_VOICE })
    expect(out.audio.byteLength).toBeGreaterThan(1000)
    expect(['eleven_v4', 'eleven_multilingual_v2']).toContain(out.modelUsed)
    const words = wordsFromAlignment(out.alignment, { offsetS: 0, sceneSlot: 0 })
    expect(words.length).toBeGreaterThan(2)
    const dur = durationMsFromAlignment(out.alignment)
    expect(words[0].s).toBeLessThanOrEqual(0.05)
    expect(Math.abs(words[0].s * 1000)).toBeLessThanOrEqual(50)
    expect(dur).toBeGreaterThan(500)
  })

  it('default voice id appears in /v2/voices', async () => {
    const { voices } = await listVoices({ search: 'George' })
    const hit = voices.find((v) => v.voiceId === DEFAULT_T2V_VOICE.voiceId)
    expect(hit?.voiceId).toBe(DEFAULT_T2V_VOICE.voiceId)
  })
})
