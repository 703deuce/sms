import { describe, expect, it } from 'vitest'
import { uploadProgressFromMeta } from '@/lib/recording/coalesce-parts'

describe('recording upload resume progress', () => {
  it('returns 100 when finalized', () => {
    expect(uploadProgressFromMeta({ bytesUploaded: 1, bytesTotalEstimate: 10, finalized: true })).toBe(100)
  })

  it('computes percent from bytes', () => {
    expect(uploadProgressFromMeta({ bytesUploaded: 50, bytesTotalEstimate: 100, finalized: false })).toBe(50)
  })
})
