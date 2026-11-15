import { describe, expect, it } from 'vitest'
import { buildMotionStudioEditorEdits, sceneSplitsMs } from '@/lib/motion-studio/editor-timeline'
import type { ClipMotionStudioExt } from '@/lib/clips/edits'

const ext: ClipMotionStudioExt = {
  v: 1, projectId: 'ms1', timelineVersion: 1, durationMs: 20000, fps: 30, tracks: [],
  segments: [{ startMs: 0, endMs: 6000 }, { startMs: 6000, endMs: 11000 }, { startMs: 11000, endMs: 20000 }],
}
const markers = [{ id: 'ms_ch_1', ms: 500, color: 'purple' as const, label: 'The setup', chapter: true as const }]

describe('Motion Studio -> Compact Editor timeline', () => {
  it('splits the Video lane at every scene / footage insert and puts the score on the Music lane', () => {
    const e = buildMotionStudioEditorEdits({ base: null, durationMs: 20000, patch: { markers, motionStudio: ext }, musicUploadId: 'msmuA', lastPlacedMusicUploadId: null })
    expect(e.trim).toEqual({ in: 0, out: 20000 })
    expect(e.videoSplits).toEqual([6000, 11000])
    expect(e.audio?.music).toMatchObject({ uploadId: 'msmuA', generationId: 'msmuA', volume: 1, startMs: 0, endMs: 20000 })
    expect(e.markers).toEqual(markers)
    expect(e.layout?.mode).toBe('full_frame')
  })

  it('re-sync keeps user edits, the user\'s own music and a music removal', () => {
    const first = buildMotionStudioEditorEdits({ base: null, durationMs: 20000, patch: { markers, motionStudio: ext }, musicUploadId: 'msmuA', lastPlacedMusicUploadId: null })
    const userTweaked = { ...first, markers: [...(first.markers ?? []), { id: 'u1', ms: 9000, color: 'red' as const }],
      audio: { ...first.audio!, music: { ...first.audio!.music!, volume: 0.4 } } }
    const v2 = { ...ext, timelineVersion: 2, segments: [{ startMs: 0, endMs: 7000 }, { startMs: 7000, endMs: 21000 }] }
    const again = buildMotionStudioEditorEdits({ base: userTweaked, durationMs: 21000, patch: { markers, motionStudio: v2 }, musicUploadId: 'msmuB', lastPlacedMusicUploadId: 'msmuA' })
    expect(again.videoSplits).toEqual([7000])
    expect(again.audio?.music).toMatchObject({ uploadId: 'msmuB', volume: 0.4, endMs: 21000 })
    expect(again.markers?.map(m => m.id)).toEqual(['ms_ch_1', 'u1'])

    const own = { ...first, audio: { music: { generationId: 'up_mine', uploadId: 'up_mine', volume: 0.7 }, sfx: [] } }
    expect(buildMotionStudioEditorEdits({ base: own, durationMs: 20000, patch: { motionStudio: ext }, musicUploadId: 'msmuB', lastPlacedMusicUploadId: 'msmuA' }).audio?.music?.uploadId).toBe('up_mine')

    const removed = { ...first, audio: { music: null, sfx: [] } }
    expect(buildMotionStudioEditorEdits({ base: removed, durationMs: 20000, patch: { motionStudio: ext }, musicUploadId: 'msmuB', lastPlacedMusicUploadId: 'msmuA' }).audio?.music).toBeNull()
  })

  it('older assemblies without a music stem keep the full-mix canvas and no music item', () => {
    const e = buildMotionStudioEditorEdits({ base: null, durationMs: 20000, patch: { motionStudio: ext }, musicUploadId: null, lastPlacedMusicUploadId: null })
    expect(e.audio?.music).toBeNull()
    expect(sceneSplitsMs(undefined, 1000)).toEqual([])
  })
})
