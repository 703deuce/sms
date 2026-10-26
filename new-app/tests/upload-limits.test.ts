import { describe, expect, it } from 'vitest'
import {
  clipUploadEffectiveMaxBytes,
  clipUploadMaxBytes,
  formatClipUploadMaxLabel,
} from '@/lib/server/clips/upload-limits'
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

  it('effective max is capped by supabase object limit when driver is supabase', () => {
    const prevDriver = process.env.STORAGE_DRIVER
    const prevObj = process.env.SUPABASE_OBJECT_MAX_BYTES
    const prevClip = process.env.CLIPS_MAX_UPLOAD_BYTES
    process.env.STORAGE_DRIVER = 'supabase'
    process.env.CLIPS_MAX_UPLOAD_BYTES = String(20 * 1024 * 1024 * 1024)
    process.env.SUPABASE_OBJECT_MAX_BYTES = String(50 * 1024 * 1024)
    expect(clipUploadEffectiveMaxBytes()).toBe(50 * 1024 * 1024)
    if (prevDriver !== undefined) process.env.STORAGE_DRIVER = prevDriver
    else delete process.env.STORAGE_DRIVER
    if (prevObj !== undefined) process.env.SUPABASE_OBJECT_MAX_BYTES = prevObj
    else delete process.env.SUPABASE_OBJECT_MAX_BYTES
    if (prevClip !== undefined) process.env.CLIPS_MAX_UPLOAD_BYTES = prevClip
    else delete process.env.CLIPS_MAX_UPLOAD_BYTES
  })

  it('reads CLIPS_MAX_UPLOAD_BYTES alias', () => {
    const prev = process.env.CLIPS_MAX_UPLOAD_BYTES
    const prev2 = process.env.CLIPS_UPLOAD_MAX_BYTES
    delete process.env.CLIPS_UPLOAD_MAX_BYTES
    process.env.CLIPS_MAX_UPLOAD_BYTES = String(100 * 1024 * 1024)
    expect(clipUploadMaxBytes()).toBe(100 * 1024 * 1024)
    if (prev !== undefined) process.env.CLIPS_MAX_UPLOAD_BYTES = prev
    else delete process.env.CLIPS_MAX_UPLOAD_BYTES
    if (prev2 !== undefined) process.env.CLIPS_UPLOAD_MAX_BYTES = prev2
  })
})
