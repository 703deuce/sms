import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  findFirst: vi.fn(),
  storage: vi.fn(),
  getSize: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({ clipUpload: { findFirst: mock.findFirst } }),
}))
vi.mock('@/lib/storage', () => ({
  getClipStorage: mock.storage,
  storageDriverName: () => 's3',
  uploadSourceKey: vi.fn(),
}))
vi.mock('@/lib/storage/supabase-driver', () => ({
  getSupabaseStorageConfig: vi.fn(),
  SIGNED_PUT_MAX_BYTES: 1024,
}))
vi.mock('@/lib/server/clips/upload-s3-resume', () => ({
  s3PartSizeBytes: () => 1024,
  buildS3MultipartResumeSession: vi.fn(),
}))
vi.mock('@/lib/server/clips/upload-limits', () => ({
  clipUploadEffectiveMaxBytes: () => 1024,
  formatClipUploadMaxLabel: () => '1 KB',
}))

import { getClipUploadProgress } from '@/lib/server/clips/uploads'

describe('PR7 LG15 interrupted upload status uses recorded storage backend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.findFirst.mockResolvedValue({
      id: 'upl_legacy',
      workspaceId: 'ws_fixture',
      status: 'PENDING',
      bytes: 2000n,
      key: 'private/upload.mp4',
      filename: 'upload.mp4',
      storageDriver: 'supabase',
      uploadMode: 'signed_put',
      s3UploadId: null,
    })
    mock.getSize.mockResolvedValue(1250)
    mock.storage.mockReturnValue({ getObjectSizeBytes: mock.getSize })
  })

  it('polls the stored driver instead of the current new-upload default', async () => {
    const progress = await getClipUploadProgress('ws_fixture', 'upl_legacy')
    expect(mock.storage).toHaveBeenCalledWith('supabase')
    expect(mock.getSize).toHaveBeenCalledWith('private/upload.mp4')
    expect(progress).toMatchObject({ status: 'PENDING', received: 1250, bytes: 2000, canResume: true })
  })

  it('reports completed uploads as complete without polling remote size', async () => {
    mock.findFirst.mockResolvedValueOnce({
      id: 'upl_complete', status: 'COMPLETE', bytes: 2000n, key: 'private/complete.mp4',
      filename: 'complete.mp4', storageDriver: 'supabase', uploadMode: 'signed_put',
      s3UploadId: null,
    })
    const progress = await getClipUploadProgress('ws_fixture', 'upl_complete')
    expect(progress.received).toBe(2000)
    expect(progress.canResume).toBe(false)
    expect(mock.getSize).not.toHaveBeenCalled()
  })
})
