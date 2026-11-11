import { describe, expect, it } from 'vitest'
import { buildKieCreateRequest, resolveStudioCreateInput } from '@/lib/studio/models'

describe('Seedance 2.5 KIE request mapping', () => {
  const frameUrl = 'https://img.example.test/first.png'
  const endUrl = 'https://img.example.test/last.png'

  it('sends adaptive aspect_ratio for image-to-video (user aspect stays in resolved input only)', () => {
    const resolved = resolveStudioCreateInput({
      modelId: 'seedance-2.5',
      mode: 'image_to_video',
      prompt: 'product hero motion',
      aspect: '9:16',
      durationSec: 15,
      resolution: '720p',
      startFrameAssetId: 'asset_start',
    })
    expect(resolved.aspect).toBe('9:16')

    const req = buildKieCreateRequest(resolved, { startFrameUrl: frameUrl })
    expect(req).toEqual({
      api: 'jobs',
      model: 'bytedance/seedance-2-5',
      input: {
        prompt: 'product hero motion',
        duration: 15,
        resolution: '720p',
        generate_audio: true,
        output_format: 'mp4',
        nsfw_checker: false,
        first_frame_url: frameUrl,
        aspect_ratio: 'adaptive',
      },
    })
  })

  it('sends adaptive aspect_ratio for first-and-last-frame image-to-video', () => {
    const resolved = resolveStudioCreateInput({
      modelId: 'seedance-2.5',
      mode: 'image_to_video',
      prompt: 'morph between frames',
      aspect: '16:9',
      durationSec: 8,
      startFrameAssetId: 'asset_start',
      endFrameAssetId: 'asset_end',
    })
    const req = buildKieCreateRequest(resolved, { startFrameUrl: frameUrl, endFrameUrl: endUrl })
    expect(req.input.aspect_ratio).toBe('adaptive')
    expect(req.input.first_frame_url).toBe(frameUrl)
    expect(req.input.last_frame_url).toBe(endUrl)
  })

  it('keeps user aspect_ratio for text-to-video', () => {
    const resolved = resolveStudioCreateInput({
      modelId: 'seedance-2.5',
      mode: 'text_to_video',
      prompt: 'a cat walks in rain',
      aspect: '9:16',
      durationSec: 15,
      resolution: '720p',
    })
    const req = buildKieCreateRequest(resolved, {})
    expect(req.input.aspect_ratio).toBe('9:16')
    expect(req.input.first_frame_url).toBeUndefined()
  })

  it('keeps user aspect_ratio for text-to-video with reference image only', () => {
    const resolved = resolveStudioCreateInput({
      modelId: 'seedance-2.5',
      mode: 'text_to_video',
      prompt: 'match the product style',
      aspect: '3:4',
      referenceAssetId: 'asset_ref',
    })
    const req = buildKieCreateRequest(resolved, { referenceUrl: frameUrl })
    expect(req.input.aspect_ratio).toBe('3:4')
    expect(req.input.reference_image_urls).toEqual([frameUrl])
    expect(req.input.first_frame_url).toBeUndefined()
  })
})
