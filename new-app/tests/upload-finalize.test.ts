import { describe, expect, it, vi } from 'vitest'
import fsp from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { finalizeAssembledUploadToStorageKey } from '@/lib/server/clips/upload-finalize'
import type { ClipStorageDriver } from '@/lib/storage/types'

describe('finalizeAssembledUploadToStorageKey', () => {
  it('[U] returns storage object key and skips upload when size matches', async () => {
    const uploadId = 'upl_test_finalize'
    const root = path.join(os.tmpdir(), 'transovo-clip-uploads')
    const file = path.join(root, `${uploadId}.bin`)
    await fsp.mkdir(root, { recursive: true })
    await fsp.writeFile(file, Buffer.alloc(1024, 1))

    const storage: ClipStorageDriver = {
      name: 'supabase',
      createUpload: vi.fn(),
      completeUpload: vi.fn(),
      abortUpload: vi.fn(),
      putJson: vi.fn(),
      putBytes: vi.fn(),
      putStream: vi.fn(),
      getJson: vi.fn(),
      createSignedDownloadUrl: vi.fn(),
      getObjectSizeBytes: vi.fn().mockResolvedValue(1024),
    }

    const key = 'ws/upl_test_finalize/source.mp4'
    const out = await finalizeAssembledUploadToStorageKey(storage, key, uploadId, 'video/mp4', 1024)
    expect(out).toBe(key)
    expect(storage.putStream).not.toHaveBeenCalled()
    await fsp.unlink(file).catch(() => {})
  })

  it('[U] rejects @staging/ keys', async () => {
    const storage: ClipStorageDriver = {
      name: 'supabase',
      createUpload: vi.fn(),
      completeUpload: vi.fn(),
      abortUpload: vi.fn(),
      putJson: vi.fn(),
      putBytes: vi.fn(),
      putStream: vi.fn(),
      getJson: vi.fn(),
      createSignedDownloadUrl: vi.fn(),
      getObjectSizeBytes: vi.fn(),
    }
    await expect(
      finalizeAssembledUploadToStorageKey(storage, '@staging/upl_x', 'upl_x', 'video/mp4', 10),
    ).rejects.toThrow(/staging/)
  })
})
