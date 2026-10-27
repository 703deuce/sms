import { describe, expect, it } from 'vitest'
import {
  EXPORT_HEADLINE_MAX_REGENERATIONS,
  channelUrlFromVodUrl,
  formatHeadlineForExport,
  headlineBarAllowedForLayout,
  headlineBarLayout,
  normalizeChannelUrl,
} from '@/lib/clips/export-template'

describe('export-template', () => {
  it('headlineBarAllowedForLayout blocks split layouts', () => {
    expect(headlineBarAllowedForLayout('speaker_follow')).toBe(true)
    expect(headlineBarAllowedForLayout('split')).toBe(false)
    expect(headlineBarAllowedForLayout('grid3')).toBe(false)
    expect(headlineBarAllowedForLayout('screen_pip')).toBe(false)
  })

  it('validates twitch and kick channel urls', () => {
    expect(normalizeChannelUrl('twitch.tv/ninja')).toBe('https://twitch.tv/ninja')
    expect(normalizeChannelUrl('https://kick.com/xqc')).toBe('https://kick.com/xqc')
    expect(normalizeChannelUrl('https://youtube.com/foo')).toBeNull()
  })

  it('parses channel from vod url', () => {
    expect(channelUrlFromVodUrl('https://www.twitch.tv/summit1g/video/123')).toBe('https://twitch.tv/summit1g')
    expect(channelUrlFromVodUrl('https://kick.com/adin/videos/abc')).toBe('https://kick.com/adin')
  })

  it('caps regenerations constant', () => {
    expect(EXPORT_HEADLINE_MAX_REGENERATIONS).toBe(5)
  })

  it('formatHeadlineForExport uppercases and caps length', () => {
    expect(formatHeadlineForExport('he lost it at chat 🔥😂')).toBe('HE LOST IT AT CHAT 🔥😂')
    expect(formatHeadlineForExport('x'.repeat(50)).length).toBeLessThanOrEqual(44)
  })

  it('headlineBarLayout respects Shorts safe zone', () => {
    const shorts = headlineBarLayout('youtube_shorts', 1920)
    expect(shorts.textTopPx).toBeGreaterThanOrEqual(380)
    const tiktok = headlineBarLayout('tiktok', 1920)
    expect(tiktok.textTopPx).toBeGreaterThanOrEqual(260)
  })

  it('allows headline on full_frame layout', () => {
    expect(headlineBarAllowedForLayout('full_frame')).toBe(true)
  })
})
