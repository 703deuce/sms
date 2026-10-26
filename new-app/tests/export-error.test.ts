import { describe, expect, it } from 'vitest'
import { formatExportError } from '@/lib/clips/export-error'

describe('formatExportError', () => {
  it('keeps short messages inline', () => {
    expect(formatExportError('Clip too long')).toEqual({
      message: 'Clip too long',
      details: null,
    })
  })

  it('maps download_object UnboundLocalError to friendly copy', () => {
    const raw =
      "cannot access local variable 'download_object' where it is not associated with a value"
    const out = formatExportError(raw)
    expect(out.message).toContain('Retry')
    expect(out.details).toBe(raw)
  })
})
