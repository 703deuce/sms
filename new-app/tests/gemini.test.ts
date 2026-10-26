import { describe, expect, it, vi, beforeEach } from 'vitest'

describe('gemini vision model discovery', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    delete process.env.VISION_MODEL
  })

  it('picks latest flash-lite with generateContent', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.5-flash-lite-preview', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { discoverVisionFlashLiteModel } = await import('@/lib/server/ai/gemini')
    const model = await discoverVisionFlashLiteModel()
    expect(model).toBe('gemini-2.5-flash-lite-preview')
  })
})
