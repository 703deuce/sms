// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { validateSvgLogoMarkup } from '../../lib/motion-studio/logo-upload'

describe('SVG logo validation', () => {
  it('accepts a normal SVG with standard namespace declarations and inline paths', () => {
    const normal = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64"><path fill="#123456" d="M0 0H64V64Z" /></svg>'
    expect(validateSvgLogoMarkup(normal).documentElement.localName).toBe('svg')
  })
  it('accepts an Inkscape namespace and strips editor-only nodes', () => {
    const inkscape = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"><sodipodi:namedview/><g inkscape:label="Layer 1"><path d="M0 0L10 10"/></g></svg>`
    const sanitized = validateSvgLogoMarkup(inkscape)
    expect(sanitized.querySelector('path')).toBeTruthy()
    expect(sanitized.querySelector('namedview')).toBeNull()
  })
  it('rejects executable markup and external references', () => {
    expect(() => validateSvgLogoMarkup('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')).toThrow()
    expect(() => validateSvgLogoMarkup('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/track"/></svg>')).toThrow()
    expect(() => validateSvgLogoMarkup('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>')).toThrow()
  })
})
