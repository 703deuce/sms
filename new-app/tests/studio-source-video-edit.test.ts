// @ts-expect-error vitest is resolved in new-app; root tsc has no vitest types
import { describe, expect, it } from 'vitest'

import { parseStudioRegistry } from '../lib/ai-studio/parse'
import {
  buildKieCreateRequest,
  getStudioRegistryDocument,
  resolveStudioCreateInput,
} from '../lib/studio/models'

describe('Mode 6 source-video edit contract', () => {
  it('keeps source-video edit models out of the existing Studio registry by default', () => {
    const normal = getStudioRegistryDocument()
    expect(normal.models.some((model) => model.modes.includes('source_video_edit'))).toBe(false)

    const videoEdit = getStudioRegistryDocument({ mode: 'source_video_edit' })
    expect(videoEdit.models.map((model) => model.id)).toEqual(['wan-2.7-video-edit'])
    expect(videoEdit.models[0]?.sourceVideoEdit).toEqual({
      minDurationSec: 2,
      maxDurationSec: 10,
      creditPerSecondByResolution: { '720p': 16, '1080p': 24 },
    })

    const parsed = parseStudioRegistry(videoEdit)
    expect(parsed.models[0]?.sourceVideoEdit?.creditPerSecondByResolution['720p']).toBe(16)
  })

  it('builds the verified Wan Video Edit request and prices the selected duration', () => {
    const resolved = resolveStudioCreateInput({
      modelId: 'wan-2.7-video-edit',
      mode: 'source_video_edit',
      prompt: 'Change the jacket to blue while preserving motion.',
      durationSec: 4,
      resolution: '720p',
      sourceVideoAssetId: 'stast_source',
      referenceAssetId: 'stast_reference',
      projectId: 'proj_1',
    })

    expect(resolved.creditEstimate).toBe(64)
    const request = buildKieCreateRequest(resolved, {
      sourceVideoUrl: 'https://storage.example/source.mp4?token=x',
      referenceUrl: 'https://storage.example/reference.jpg?token=y',
    })

    expect(request.api).toBe('jobs')
    expect(request.model).toBe('wan/2-7-videoedit')
    expect(request.input).toMatchObject({
      prompt: 'Change the jacket to blue while preserving motion.',
      video_url: 'https://storage.example/source.mp4?token=x',
      reference_image: 'https://storage.example/reference.jpg?token=y',
      resolution: '720p',
      duration: 4,
      audio_setting: 'origin',
      prompt_extend: true,
      watermark: false,
    })
    expect(request.input).not.toHaveProperty('aspect_ratio')
  })

  it('rejects source-video edits without an authorized source asset', () => {
    expect(() =>
      resolveStudioCreateInput({
        modelId: 'wan-2.7-video-edit',
        mode: 'source_video_edit',
        prompt: 'Change the jacket.',
        durationSec: 4,
        resolution: '720p',
      }),
    ).toThrow(/sourceVideoAssetId/)
  })
})
