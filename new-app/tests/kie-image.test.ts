import { describe, expect, it } from 'vitest'
import { buildNanoBananaTaskBody, parseResultImageUrl } from '@/lib/server/ai/kie-image'

describe('kie-image', () => {
  it('builds nano banana task body', () => {
    const body = buildNanoBananaTaskBody({
      prompt: 'Bold YouTube thumbnail',
      imageUrls: ['https://example.com/ref.jpg'],
      aspectRatio: '16:9',
      callBackUrl: 'https://app/cb',
    })
    expect(body.model).toBe('nano-banana-2')
    expect(body.input.resolution).toBe('2K')
    expect(body.input.aspect_ratio).toBe('16:9')
    expect(body.input.image_input).toEqual(['https://example.com/ref.jpg'])
  })

  it('parses result image url', () => {
    const url = parseResultImageUrl(JSON.stringify({ resultUrls: ['https://cdn/img.png'] }))
    expect(url).toBe('https://cdn/img.png')
  })
})
