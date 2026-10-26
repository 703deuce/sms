import { describe, expect, it } from 'vitest'
import { friendlyUploadError } from '@/lib/clips/upload-errors'

describe('friendlyUploadError', () => {
  it('maps 413 to a clear message', () => {
    expect(friendlyUploadError(new Error('x'), 413)).toMatch(/413/i)
  })

  it('detects 413 in message text', () => {
    expect(friendlyUploadError(new Error('HTTP 413'))).toMatch(/too large/i)
  })

  it('[U] explains deploy interruption with resume hint', () => {
    expect(friendlyUploadError(new Error('Chunk offset mismatch'))).toMatch(/Retry/i)
  })

  it('[U] maps misleading storage size errors honestly', () => {
    expect(friendlyUploadError(new Error('object exceeded the maximum allowed size'))).toMatch(/bucket limit/i)
  })
})
