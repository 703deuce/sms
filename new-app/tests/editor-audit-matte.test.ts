import { describe, expect, it } from 'vitest'
import { mattePreviewFingerprint } from '@/lib/server/clips/matte-preview-fingerprint'

describe('Editor audit: stale matte invalidation', () => {
  const clip = { sourceSegKey: 'segment/a.mp4', sourceSegStartMs: 0, previewKey: 'preview/a.mp4', startMs: 1000, endMs: 9000 }
  it('matches identical source windows', () => {
    expect(mattePreviewFingerprint(clip)).toBe(mattePreviewFingerprint({ ...clip }))
  })
  it('invalidates when footage, trim window or source offset changes', () => {
    const fingerprint = mattePreviewFingerprint(clip)
    expect(mattePreviewFingerprint({ ...clip, sourceSegKey: 'segment/b.mp4' })).not.toBe(fingerprint)
    expect(mattePreviewFingerprint({ ...clip, startMs: 2000 })).not.toBe(fingerprint)
    expect(mattePreviewFingerprint({ ...clip, endMs: 7500 })).not.toBe(fingerprint)
    expect(mattePreviewFingerprint({ ...clip, sourceSegStartMs: 1500 })).not.toBe(fingerprint)
  })
})
