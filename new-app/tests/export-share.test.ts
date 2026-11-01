import { describe, expect, it } from 'vitest'
import {
  buildRenderShareUrls,
  generateRenderShareSlug,
  isValidRenderShareSlug,
  parseRenderShareAccessToken,
  renderSharePagePath,
  renderSharePublicApiPath,
} from '@/lib/clips/export-share'

describe('export-share helpers', () => {
  it('generates slug matching validation regex', () => {
    const slug = generateRenderShareSlug()
    expect(isValidRenderShareSlug(slug)).toBe(true)
  })

  it('builds page and api paths', () => {
    expect(renderSharePublicApiPath('abc123456789')).toBe('/api/public/share/renders/abc123456789')
    expect(renderSharePagePath('abc123456789', 'tok')).toContain('t=tok')
  })

  it('builds absolute share urls with access token query', () => {
    const urls = buildRenderShareUrls('https://app.example.com', 'abc1234567890', 'secret')
    expect(urls.pageUrl).toBe('https://app.example.com/share/renders/abc1234567890?t=secret')
    expect(urls.apiPath).toContain('t=secret')
  })

  it('parses access token from request url', () => {
    expect(parseRenderShareAccessToken('https://x.test/share/renders/s?t=abc')).toBe('abc')
    expect(parseRenderShareAccessToken('https://x.test/share/renders/s')).toBeNull()
  })
})
