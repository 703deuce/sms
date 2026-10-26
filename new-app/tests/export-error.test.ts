import { describe, expect, it } from 'vitest'
import { formatExportError } from '@/lib/clips/export-error'

describe('formatExportError', () => {
  it('keeps short messages inline', () => {
    expect(formatExportError('Clip too long')).toEqual({
      message: 'Clip too long',
      details: null,
    })
  })
})
