import { describe, expect, it } from 'vitest'
import { clipExportMediaReady } from '@/lib/clips/clip-export-media'

describe('AI Producer source-backed MP4 export eligibility', () => {
  const aiProject = {
    settings: { aiProducerRunId: 'aprun_test' },
    proxyKey: null,
    upload: { key: 'ws/test/source.mp4' },
  }

  it('permits an AI Producer output without a preview when its source upload exists', () => {
    expect(clipExportMediaReady({ previewKey: null, sourceSegKey: null }, aiProject)).toBe(true)
  })

  it('permits the proxy or segment when the upload is unavailable', () => {
    const clip = { previewKey: null, sourceSegKey: null }
    expect(clipExportMediaReady(clip, {
      ...aiProject, upload: { key: null }, proxyKey: 'ws/test/proxy.mp4',
    })).toBe(true)
    expect(clipExportMediaReady({ ...clip, sourceSegKey: 'ws/test/clip.mp4' }, {
      ...aiProject, upload: { key: null },
    })).toBe(true)
  })

  it('does not treat an AI Producer project marker as proof of available media', () => {
    expect(clipExportMediaReady({ previewKey: null, sourceSegKey: null }, {
      ...aiProject, upload: { key: null }, proxyKey: null,
    })).toBe(false)
  })

  it('keeps normal clips without previews blocked unless they are source-backed full videos', () => {
    const clip = { previewKey: null, sourceSegKey: null }
    expect(clipExportMediaReady(clip, {
      settings: {}, proxyKey: 'ws/test/proxy.mp4', upload: { key: null },
    })).toBe(false)
    expect(clipExportMediaReady(clip, {
      settings: { fullVideo: true }, proxyKey: 'ws/test/proxy.mp4', upload: { key: null },
    })).toBe(true)
    expect(clipExportMediaReady({ ...clip, previewKey: 'ws/test/preview.mp4' }, null)).toBe(true)
  })
})
