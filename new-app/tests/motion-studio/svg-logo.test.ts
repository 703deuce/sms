// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { validateSvgLogoMarkup } from '../../lib/motion-studio/logo-upload'

describe('SVG logo validation', () => {
  it('accepts a normal SVG with standard namespace declarations and inline paths', () => {
    const normal = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64"><path fill="#123456" d="M0 0H64V64Z" /></svg>'
    expect(validateSvgLogoMarkup(normal).documentElement.localName).toBe('svg')
  })
  it('rejects executable markup and external references', () => {
    expect(() => validateSvgLogoMarkup('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')).toThrow()
    expect(() => validateSvgLogoMarkup('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/track"/></svg>')).toThrow()
    expect(() => validateSvgLogoMarkup('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>')).toThrow()
  })
})
