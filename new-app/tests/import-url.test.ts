import { describe, expect, it } from 'vitest'
import {
  classifyImportUrl,
  googleDriveDownloadUrl,
  normalizeDropboxShareUrl,
  parseGoogleDriveFileId,
  validateImportUrlForSubmit,
} from '@/lib/clips/import-url'

describe('import-url', () => {
  it('classifies hosts', () => {
    expect(classifyImportUrl('https://drive.google.com/file/d/x/view')).toBe('drive')
    expect(classifyImportUrl('https://www.dropbox.com/s/a/b.mp4')).toBe('dropbox')
    expect(classifyImportUrl('https://youtu.be/abc')).toBe('youtube')
  })

  it('accepts YouTube and Twitch VOD links', () => {
    expect(validateImportUrlForSubmit('https://www.youtube.com/watch?v=abc')).toEqual({
      ok: true,
      kind: 'youtube',
    })
    expect(validateImportUrlForSubmit('https://www.twitch.tv/videos/1234567890')).toEqual({
      ok: true,
      kind: 'twitch',
    })
  })

  it('parses drive id and builds download url', () => {
    expect(parseGoogleDriveFileId('https://drive.google.com/file/d/FILE9/view')).toBe('FILE9')
    expect(googleDriveDownloadUrl('FILE9')).toContain('id=FILE9')
  })

  it('rewrites dropbox links', () => {
    expect(normalizeDropboxShareUrl('https://www.dropbox.com/s/x/y.mp4?dl=0')).toContain('dl=1')
    expect(normalizeDropboxShareUrl('https://www.dropbox.com/scl/fi/x/y.mp4')).toContain('raw=1')
  })
})
