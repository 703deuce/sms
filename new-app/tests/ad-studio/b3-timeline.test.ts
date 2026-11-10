import { describe, expect, it } from 'vitest'
import { buildAdTimelineEdits } from '@/lib/ad-studio/timeline'

describe('Ad Studio B3e timeline', () => {
  it('keeps stock source in/out, generated trims, original photos and VO', () => {
    const edits = buildAdTimelineEdits({
      durationMs: 15000, aspect: '9:16',
      scenes: [
        { id: 'a', index: 0, source: 'stock', status: 'ready', startMs: 0, endMs: 4000,
          stockAssetId: 'stock_a', sourceInMs: 9000 },
        { id: 'b', index: 1, source: 'generated', status: 'ready', startMs: 4000, endMs: 7000,
          uploadId: 'upl_gen', trimInMs: 0 },
        { id: 'c', index: 2, source: 'generated', status: 'skipped', startMs: 7000, endMs: 15000 },
      ],
      productPhotos: [{ uploadId: 'upl_photo', label: 'Original product' }],
      voice: { uploadId: 'upl_voice', durationMs: 12000 },
    })
    expect(edits.broll?.[0]).toMatchObject({ source: 'stock', inMs: 9000, startMs: 0, endMs: 4000 })
    expect(edits.sourceSegments?.[0]).toMatchObject({ startMs: 4000, endMs: 7000, inMs: 0 })
    expect(edits.sources?.some(x => x.refId === 'upl_photo' && x.mediaType === 'image')).toBe(true)
    expect(edits.audio?.sfx[0]).toMatchObject({ uploadId: 'upl_voice', kind: 'audio' })
    expect(edits.trim).toEqual({ in: 0, out: 15000 })
  })
})
