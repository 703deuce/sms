import { describe, expect, it } from 'vitest'
import {
  bytesReceivedFromParts,
  mergePartRecords,
  missingPartNumbers,
} from '@/lib/server/clips/upload-part-bookkeeping'

describe('upload part bookkeeping', () => {
  const partSize = 10 * 1024 * 1024

  it('[U] sums recorded part sizes', () => {
    const parts = [
      { partNumber: 1, etag: 'a', sizeBytes: partSize },
      { partNumber: 2, etag: 'b', sizeBytes: 5_000_000 },
    ]
    expect(bytesReceivedFromParts(parts, partSize, 15_000_000)).toBe(15_000_000)
  })

  it('[U] lists missing part numbers', () => {
    const parts = [{ partNumber: 1, etag: 'a', sizeBytes: partSize }]
    expect(missingPartNumbers(parts, partSize, 25_000_000)).toEqual([2, 3])
  })

  it('[U] merges part records by part number', () => {
    const merged = mergePartRecords([{ partNumber: 1, etag: 'old' }], { partNumber: 1, etag: 'new' })
    expect(merged).toEqual([{ partNumber: 1, etag: 'new' }])
  })
})
