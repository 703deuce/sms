import { describe, expect, it } from 'vitest'
import { uploadLimitExceededMessage } from '@/lib/clips/upload-limit-message'
import { friendlyUploadError, isUploadErrorRetryable } from '@/lib/clips/upload-errors'

describe('upload limit messaging', () => {
  it('uses configured limit in copy', () => {
    expect(uploadLimitExceededMessage('50 MB')).toContain('50 MB')
    expect(uploadLimitExceededMessage('50 MB')).toContain('Paste a link')
  })

  it('maps HTTP 413 without retry', () => {
    const msg = friendlyUploadError(new Error('x'), 413, { maxLabel: '50 MB' })
    expect(msg).toBe(uploadLimitExceededMessage('50 MB'))
    expect(isUploadErrorRetryable(new Error('x'), 413, msg)).toBe(false)
  })

  it('still allows retry for transient network errors', () => {
    expect(isUploadErrorRetryable(new Error('failed to fetch'))).toBe(true)
  })
})
