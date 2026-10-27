import { describe, expect, it } from 'vitest'
import {
  EXPORT_HEADLINE_MAX_REGENERATIONS,
  STREAM_HEADLINE_TEMPLATE_ID,
  channelUrlFromVodUrl,
  defaultStreamHeadlineExportTemplate,
  formatHeadlineForExport,
  headlineBarAllowedForLayout,
  headlineBarLayout,
  normalizeChannelUrl,
  streamHeadlineFrameLayout,
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
    expect(formatHeadlineForExport('x'.repeat(50)).length).toBeLessThanOrEqual(76)
  })

  it('headlineBarLayout uses ~20% top banner', () => {
    const shorts = headlineBarLayout('youtube_shorts', 1920)
    expect(shorts.barHeightPx).toBeGreaterThanOrEqual(384)
    expect(shorts.textTopPx).toBeGreaterThanOrEqual(200)
    expect(shorts.textTopPx).toBeLessThan(shorts.barHeightPx)
  })

  it('allows headline on full_frame layout', () => {
    expect(headlineBarAllowedForLayout('full_frame')).toBe(true)
  })

  it('stream headline frame uses 20% bar and 28% footer', () => {
    const f = streamHeadlineFrameLayout(1920)
    expect(f.barHeightPx).toBe(384)
    expect(f.footerHeightPx).toBe(538)
    expect(f.videoHeightPx).toBe(998)
  })

  it('default stream template enables badge and channel', () => {
    expect(STREAM_HEADLINE_TEMPLATE_ID).toBe('stream_headline')
    const t = defaultStreamHeadlineExportTemplate({
      platform: 'kick',
      channelUrl: 'https://kick.com/adrienbroner',
    })
    expect(t.headlineBar?.enabled).toBe(true)
    expect(t.platformBadge?.enabled).toBe(true)
    expect(t.channelLink?.url).toBe('https://kick.com/adrienbroner')
  })
})
