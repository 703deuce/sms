import { describe, expect, it } from 'vitest'
import { storageDriverName, usesS3CompatibleMultipart } from '@/lib/storage/driver-name'
import { clipUploadEffectiveMaxBytes } from '@/lib/server/clips/upload-limits'

describe('storage driver', () => {
  it('parses r2 driver', () => {
    const prev = process.env.STORAGE_DRIVER
    process.env.STORAGE_DRIVER = 'r2'
    expect(storageDriverName()).toBe('r2')
    expect(usesS3CompatibleMultipart()).toBe(true)
    if (prev !== undefined) process.env.STORAGE_DRIVER = prev
    else delete process.env.STORAGE_DRIVER
  })

  it('r2 uses full CLIPS_MAX_UPLOAD_BYTES without supabase cap', () => {
    const prevD = process.env.STORAGE_DRIVER
    const prevC = process.env.CLIPS_MAX_UPLOAD_BYTES
    const prevS = process.env.SUPABASE_OBJECT_MAX_BYTES
    process.env.STORAGE_DRIVER = 'r2'
    process.env.CLIPS_MAX_UPLOAD_BYTES = String(5 * 1024 * 1024 * 1024)
    process.env.SUPABASE_OBJECT_MAX_BYTES = String(50 * 1024 * 1024)
    expect(clipUploadEffectiveMaxBytes()).toBe(5 * 1024 * 1024 * 1024)
    if (prevD !== undefined) process.env.STORAGE_DRIVER = prevD
    else delete process.env.STORAGE_DRIVER
    if (prevC !== undefined) process.env.CLIPS_MAX_UPLOAD_BYTES = prevC
    else delete process.env.CLIPS_MAX_UPLOAD_BYTES
    if (prevS !== undefined) process.env.SUPABASE_OBJECT_MAX_BYTES = prevS
    else delete process.env.SUPABASE_OBJECT_MAX_BYTES
  })
})
