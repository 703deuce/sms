import { describe, expect, it } from 'vitest'
import { streamerUploadResumeAction, type PendingUploadMeta } from '@/lib/streamer/upload-resume'

function fakeFile(name: string, size: number, lastModified = 1): File {
  return { name, size, lastModified } as File
}

describe('streamer upload resume', () => {
  const saved: PendingUploadMeta = {
    uploadId: 'up_1',
    filename: 'stream_test.mp4',
    bytes: 100,
    lastModified: 42,
  }

  it('same file resumes', () => {
    expect(streamerUploadResumeAction(fakeFile('stream_test.mp4', 100, 42), saved)).toBe('resume')
  })

  it('different file replaces stale entry', () => {
    expect(streamerUploadResumeAction(fakeFile('mixed_4min.mp4', 200, 99), saved)).toBe('replace_stale')
  })
})
