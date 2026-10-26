import { describe, expect, it } from 'vitest'
import { friendlyUploadError } from '@/lib/clips/upload-errors'

describe('friendlyUploadError', () => {
  it('maps 413 to a clear message', () => {
    expect(friendlyUploadError(new Error('x'), 413)).toMatch(/too large/i)
  })

  it('detects 413 in message text', () => {
    expect(friendlyUploadError(new Error('HTTP 413'))).toMatch(/too large/i)
  })
})
