import { describe, expect, it } from 'vitest'
import { UniversalBrowserAudio } from '@/lib/motion-studio/universal-browser-audio'

// Regression: UniversalTimelinePlayer calls audio.updateUrls(assetUrls) whenever scene
// sessions arrive. The method did not exist, so every live project crashed the page
// ("This page couldn't load") as soon as its signed URLs loaded.
describe('UniversalBrowserAudio.updateUrls', () => {
  it('exists and merges freshly signed URLs without resetting configured clips', () => {
    const audio = new UniversalBrowserAudio()
    audio.configure([], { a: 'https://example.test/a?sig=1' })
    expect(() => audio.updateUrls({ b: 'https://example.test/b?sig=2' })).not.toThrow()
    expect((audio as unknown as { urls: Record<string, string> }).urls).toEqual({
      a: 'https://example.test/a?sig=1', b: 'https://example.test/b?sig=2',
    })
  })
})
