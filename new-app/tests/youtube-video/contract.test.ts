import { describe, expect, it } from 'vitest'
import { estimateYoutubeVideoCredits } from '@/lib/youtube-video/credits'
import { requestHash, resolveIdempotencyKey, validateCreateInput } from '@/lib/youtube-video/request'
import { YoutubeVideoError } from '@/lib/youtube-video/errors'
import { CLIP_ANALYSIS_CHUNK_MS, clipAnalysisChunks } from '@/lib/youtube-video/chunking'
import { cutOverlapFraction, sortAndMergeCuts } from '@/lib/youtube-video/assemble'
import { YOUTUBE_VIDEO_STORY_SYSTEM, assertAgnosticPrompt } from '@/lib/youtube-video/story-options'

describe('youtube-video contract helpers', () => {
  it('requires an idempotency key and replays the same hash', () => {
    expect(() => resolveIdempotencyKey(null, undefined)).toThrow(YoutubeVideoError)
    expect(resolveIdempotencyKey('client-key-1', undefined)).toBe('client-key-1')
    expect(resolveIdempotencyKey('client-key-1', 'client-key-1')).toBe('client-key-1')
    expect(() => resolveIdempotencyKey('client-key-1', 'client-key-2')).toThrow(/must match/)
    const a = requestHash({
      sources: [{ kind: 'upload', projectId: 'proj_1' }],
      instruction: '  ',
    })
    const b = requestHash({
      sources: [{ kind: 'upload', projectId: 'proj_1' }],
    })
    expect(a).toBe(b)
  })

  it('accepts 1–5 upload or twitch/kick sources and rejects other urls', () => {
    const ok = validateCreateInput({
      sources: [
        { kind: 'upload', projectId: 'proj_1' },
        { kind: 'url', url: 'https://www.twitch.tv/videos/123' },
      ],
    })
    expect(ok.sources).toHaveLength(2)
    expect(() => validateCreateInput({ sources: [] })).toThrow(YoutubeVideoError)
    expect(() => validateCreateInput({
      sources: [{ kind: 'url', url: 'https://youtube.com/watch?v=abc' }],
    })).toThrow(/Twitch or Kick/)
  })

  it('chunks long sources like the editor, in 20 minute slices', () => {
    expect(CLIP_ANALYSIS_CHUNK_MS).toBe(20 * 60_000)
    expect(clipAnalysisChunks(0, 65 * 60_000)).toEqual([
      [0, 20 * 60_000],
      [20 * 60_000, 40 * 60_000],
      [40 * 60_000, 60 * 60_000],
      [60 * 60_000, 65 * 60_000],
    ])
  })

  it('sorts cuts chronologically and merges overlap above 60%', () => {
    const merged = sortAndMergeCuts([
      { sourceId: 's0', startMs: 20_000, endMs: 40_000, label: 'later' },
      { sourceId: 's0', startMs: 0, endMs: 10_000, label: 'first' },
      { sourceId: 's0', startMs: 21_000, endMs: 39_000, label: 'dup' },
    ])
    expect(merged.map((cut) => cut.label)).toEqual(['first', 'later'])
    expect(cutOverlapFraction(merged[1]!, { sourceId: 's0', startMs: 21_000, endMs: 39_000 })).toBeGreaterThan(0.6)
  })

  it('estimates credits without using money', () => {
    expect(estimateYoutubeVideoCredits(25 * 60_000, 1)).toBe(3)
    expect(estimateYoutubeVideoCredits(25 * 60_000, 3)).toBe(7)
  })

  it('keeps the copied story prompt content-agnostic', () => {
    expect(() => assertAgnosticPrompt(YOUTUBE_VIDEO_STORY_SYSTEM)).not.toThrow()
    expect(YOUTUBE_VIDEO_STORY_SYSTEM.toLowerCase()).not.toContain('just_chatting')
    expect(YOUTUBE_VIDEO_STORY_SYSTEM.toLowerCase()).not.toContain('gaming')
  })
})
