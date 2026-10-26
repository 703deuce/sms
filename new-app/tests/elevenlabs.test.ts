import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateMusic, generateSfx } from '@/lib/server/ai/elevenlabs'

describe('elevenlabs client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.ELEVENLABS_API_KEY
  })

  it('generateMusic returns buffer and usage', async () => {
    process.env.ELEVENLABS_API_KEY = 'test-key'
    const bytes = new Uint8Array([1, 2, 3])
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => bytes.buffer,
      })),
    )
    const res = await generateMusic({ prompt: 'lo-fi beat', lengthMs: 6000, instrumental: true })
    expect(res.result).toBeInstanceOf(Buffer)
    expect(res.usage.provider).toBe('elevenlabs')
    expect(res.usage.model).toBe('music_v1')
    expect(res.usage.units).toBe(6)
    expect(res.usage.costUsdMicros).toBeGreaterThan(0)
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toContain('/v1/music')
    expect((call[1] as RequestInit).headers).toMatchObject({ 'xi-api-key': 'test-key' })
  })

  it('surfaces bad_prompt suggestion', async () => {
    process.env.ELEVENLABS_API_KEY = 'test-key'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            detail: {
              status: 'bad_prompt',
              message: 'nope',
              data: { prompt_suggestion: 'Try upbeat instrumental keys' },
            },
          }),
      })),
    )
    await expect(generateSfx({ text: 'boom', durationSec: 1 })).rejects.toThrow(/bad_prompt: Try upbeat/)
  })
})
