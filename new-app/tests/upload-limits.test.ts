import { describe, expect, it } from 'vitest'
import { clipUploadMaxBytes, formatClipUploadMaxLabel } from '@/lib/server/clips/upload-limits'
import { shouldStoreUploadOnStaging } from '@/lib/server/clips/upload-staging'
import { shouldUseAppChunkedUpload } from '@/lib/server/clips/upload-limits'

describe('upload limits', () => {
  it('formats MB labels', () => {
    expect(formatClipUploadMaxLabel(50 * 1024 * 1024)).toBe('50 MB')
    expect(formatClipUploadMaxLabel(20 * 1024 * 1024 * 1024)).toBe('20 GB')
  })

  it('defaults clipper max to 20 GB when env unset', () => {
    const prev = process.env.CLIPS_UPLOAD_MAX_BYTES
    const prevS = process.env.STREAMER_UPLOAD_MAX_BYTES
    delete process.env.CLIPS_UPLOAD_MAX_BYTES
    delete process.env.STREAMER_UPLOAD_MAX_BYTES
    expect(clipUploadMaxBytes()).toBe(20 * 1024 * 1024 * 1024)
    if (prev !== undefined) process.env.CLIPS_UPLOAD_MAX_BYTES = prev
    if (prevS !== undefined) process.env.STREAMER_UPLOAD_MAX_BYTES = prevS
  })

  it('never uses local disk staging for workers', () => {
    expect(shouldStoreUploadOnStaging(200 * 1024 * 1024)).toBe(false)
  })

  it('[U] never routes browser chunks through the web app', () => {
    expect(shouldUseAppChunkedUpload(200 * 1024 * 1024)).toBe(false)
  })
})
