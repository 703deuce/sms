import { describe, expect, it } from 'vitest'
import { presetCreateSchema } from '@/lib/server/streamer/presets'

describe('streamer presets schema', () => {
  it('accepts valid stack preset', () => {
    const parsed = presetCreateSchema.parse({
      name: 'Corner cam',
      layout: 'stack',
      facecam: { x: 0.02, y: 0.02, w: 0.3, h: 0.25 },
      split: 0.4,
    })
    expect(parsed.layout).toBe('stack')
  })

  it('rejects tiny facecam box', () => {
    expect(() =>
      presetCreateSchema.parse({
        facecam: { x: 0, y: 0, w: 0.01, h: 0.01 },
      }),
    ).toThrow()
  })
})
