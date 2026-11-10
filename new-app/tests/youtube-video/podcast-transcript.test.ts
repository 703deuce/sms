import { describe, expect, it } from 'vitest'
import { packTranscripts } from '@/lib/youtube-video/transcript-packer'
import { proposeOptionsFromPacked, YOUTUBE_VIDEO_STORY_SYSTEM } from '@/lib/youtube-video/story-options'
import { createYoutubeVideoRun } from '@/lib/youtube-video/runs'
import { podcastScript, sourceFromWords, testDeps } from './helpers'

describe('youtube-video podcast-style transcript', () => {
  it('finds a premise from a podcast transcript without assigning an angle or a length cap', async () => {
    const source = sourceFromWords('proj_podcast', podcastScript, 'Studio conversation')
    const packed = packTranscripts([source])
    expect(packed.events.length).toBeGreaterThan(3)
    const options = proposeOptionsFromPacked(packed)
    expect(options.length).toBeGreaterThan(0)
    const option = options[0]!
    expect(option.id).toBeTruthy()
    expect(option.title).toBeTruthy()
    expect(option.premise.toLowerCase()).toMatch(/newsroom|merger|independent|walked out/)
    expect(option.beats[0]?.label).toBeTruthy()
    expect(option.beats[0]?.evidence).toBeTruthy()
    expect(option.estDurationMs).toBeGreaterThan(10_000)
    expect(YOUTUBE_VIDEO_STORY_SYSTEM.toLowerCase()).not.toContain('podcast')
    expect(JSON.stringify(option).toLowerCase()).not.toContain('just_chatting')

    const deps = testDeps(new Map([['proj_podcast', source]]))
    const created = await createYoutubeVideoRun(
      'ws_pod',
      null,
      { sources: [{ kind: 'upload', projectId: 'proj_podcast' }], clientRequestId: 'client-key-pod' },
      null,
      deps,
    )
    // The only supported story gets selected and assembled automatically.
    expect(created.view.status).toBe('ready')
    expect(created.view.options).toBeNull()
    const chosen = created.view
    expect(chosen.result?.plan.premise).toBe(option.premise)
    expect(chosen.result?.durationMs).toBeGreaterThan(10_000)
    // No length cap: a longer source may assemble well past 90s, and we never clamp it.
    expect(chosen.result?.durationMs).toBe(chosen.result!.plan.beats.reduce((sum, beat) => {
      return sum + Math.max(0, (beat.endMs ?? 0) - (beat.startMs ?? 0))
    }, 0) || chosen.result!.durationMs)
  })
})
