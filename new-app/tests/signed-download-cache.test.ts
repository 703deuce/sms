import { describe, expect, it, vi } from 'vitest'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import type { ClipStorageDriver } from '@/lib/storage/types'

function mockStorage(): ClipStorageDriver {
  return {
    name: 's3',
    createUpload: vi.fn(),
    completeUpload: vi.fn(),
    abortUpload: vi.fn(),
    putJson: vi.fn(),
    putBytes: vi.fn(),
    putStream: vi.fn(),
    getJson: vi.fn(),
    createSignedDownloadUrl: vi.fn(async (key: string) => `https://signed.example/${key}?t=${Date.now()}`),
    getObjectSizeBytes: vi.fn(async () => 123),
    getObjectVersionToken: vi.fn(async () => 'etag:abc'),
  }
}

describe('createCachedSignedDownloadUrl', () => {
  it('returns the same URL for repeated calls with same object version', async () => {
    const storage = mockStorage()
    const a = await createCachedSignedDownloadUrl(storage, 'ws/x/preview.mp4')
    const b = await createCachedSignedDownloadUrl(storage, 'ws/x/preview.mp4')
    expect(a).toBe(b)
    expect(storage.createSignedDownloadUrl).toHaveBeenCalledTimes(1)
  })

  it('skips storage HEAD when versionHint is provided', async () => {
    const storage = mockStorage()
    await createCachedSignedDownloadUrl(storage, 'ws/x/out.mp4', { versionHint: 'render:r1:1:123' })
    expect(storage.getObjectVersionToken).not.toHaveBeenCalled()
    expect(storage.getObjectSizeBytes).not.toHaveBeenCalled()
    expect(storage.createSignedDownloadUrl).toHaveBeenCalledTimes(1)
  })
})
