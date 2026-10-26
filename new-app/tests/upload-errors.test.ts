import { describe, expect, it } from 'vitest'
import { friendlyUploadError } from '@/lib/clips/upload-errors'

describe('friendlyUploadError', () => {
  it('maps 413 to upload limit copy', () => {
    expect(friendlyUploadError(new Error('x'), 413, { maxLabel: '50 MB' })).toContain('50 MB')
    expect(friendlyUploadError(new Error('x'), 413, { maxLabel: '50 MB' })).toContain('contact support')
  })

  it('detects 413 in message text', () => {
    expect(friendlyUploadError(new Error('HTTP 413'), undefined, { maxLabel: '50 MB' })).toContain('50 MB')
  })

  it('[U] explains deploy interruption with resume hint', () => {
    expect(friendlyUploadError(new Error('Chunk offset mismatch'))).toMatch(/Retry/i)
  })

  it('[U] maps misleading storage size errors to limit copy', () => {
    expect(friendlyUploadError(new Error('object exceeded the maximum allowed size'), undefined, { maxLabel: '50 MB' })).toContain(
      '50 MB',
    )
  })
})
