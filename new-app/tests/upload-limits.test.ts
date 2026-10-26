import { describe, expect, it } from 'vitest'
import { formatClipUploadMaxLabel } from '@/lib/server/clips/upload-limits'

describe('upload limits', () => {
  it('formats MB labels', () => {
    expect(formatClipUploadMaxLabel(50 * 1024 * 1024)).toBe('50 MB')
    expect(formatClipUploadMaxLabel(20 * 1024 * 1024 * 1024)).toBe('20 GB')
  })
})
