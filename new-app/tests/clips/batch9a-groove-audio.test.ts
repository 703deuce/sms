import { describe, expect, it } from 'vitest'
import { BATCH9A_DEFAULT_MUSIC } from '@/lib/clips/real-video-templates/batch9a-anchors'
import {
  assertBatch9aGrooveBytes,
  buildBatch9aGrooveV2Wav,
  sha256HexBytes,
} from '@/lib/clips/real-video-templates/batch9a-groove-audio'

describe('Batch 9A groove soundtrack bytes', () => {
  it('matches the pinned first-party SHA-256', () => {
    const bytes = buildBatch9aGrooveV2Wav(BATCH9A_DEFAULT_MUSIC)
    expect(sha256HexBytes(bytes)).toBe(BATCH9A_DEFAULT_MUSIC.sha256)
    expect(() => assertBatch9aGrooveBytes(BATCH9A_DEFAULT_MUSIC, bytes)).not.toThrow()
  })
})
