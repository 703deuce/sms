import { describe, expect, it } from 'vitest'
import { captionFontStack, cssEmPerAssFontsize } from '@/lib/clips/caption-fonts'

describe('caption user fonts', () => {
  const resolve = (id: string) =>
    id === 'abc' ? { family: 'MyFont', cssEmPerAssFontsize: 0.85 } : null

  it('resolves user: stack and metrics', () => {
    expect(captionFontStack('user:abc', resolve)).toContain('MyFont')
    expect(cssEmPerAssFontsize('user:abc', resolve)).toBe(0.85)
  })

  it('falls back to Poppins for unknown user id', () => {
    expect(captionFontStack('user:missing', resolve)).toContain('Poppins')
    expect(cssEmPerAssFontsize('user:missing', resolve)).toBe(cssEmPerAssFontsize('Poppins'))
  })
})
