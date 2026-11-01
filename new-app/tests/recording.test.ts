import { describe, expect, it } from 'vitest'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import {
  addVoiceoverClip,
  estimateTakeBytes,
  pickRecorderMime,
  placeRecordedVideo,
  takeFileName,
  RECORD_MAX_MS,
} from '@/lib/clips/editor/recording'
import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'
import { trackIdOf } from '@/lib/clips/editor/tracks'

const base = (): ClipEditsV2 => defaultEdits({ clipStartMs: 0, clipEndMs: 60_000 })

const vid = (refId: string, durationMs: number): ProjectMediaItem => ({
  id: refId,
  ref: 'upload',
  refId,
  mediaType: 'video',
  label: `${refId}.mp4`,
  durationMs,
  width: 1280,
  height: 720,
  url: 'https://x/y',
  syncMs: null,
  syncStatus: 'none',
})

describe('pickRecorderMime', () => {
  it('prefers mp4 for video and opus webm for audio', () => {
    const sup = (m: string) =>
      m.startsWith('video/mp4') ||
      m.startsWith('video/webm') ||
      m.startsWith('audio/webm') ||
      m === 'audio/mp4'
    expect(pickRecorderMime('video', sup)).toMatch(/^video\/mp4/)
    expect(pickRecorderMime('audio', sup)).toBe('audio/webm;codecs=opus')
  })

  it('falls back to webm video when mp4 unsupported', () => {
    const sup = (m: string) => m.includes('webm')
    expect(pickRecorderMime('video', sup)).toContain('webm')
  })
})

describe('takeFileName', () => {
  it('numbers takes among existing labels', () => {
    expect(takeFileName('voiceover', ['Voiceover 1.webm'], 'webm')).toBe('Voiceover 2.webm')
    expect(takeFileName('camera', [], 'mp4')).toBe('Camera 1.mp4')
  })
})

describe('estimateTakeBytes', () => {
  it('scales with duration and bitrate', () => {
    expect(estimateTakeBytes(1000, 256_000)).toBe(32_000)
  })
})

describe('RECORD_MAX_MS', () => {
  it('caps takes at 30 minutes', () => {
    expect(RECORD_MAX_MS).toBe(30 * 60 * 1000)
  })
})

describe('addVoiceoverClip', () => {
  it('places an audio cue on Voiceover track at atMs', () => {
    const e = addVoiceoverClip(base(), 'upl_v1', 4000, 2500, () => 'x')
    const cue = e.audio!.sfx.find((s) => s.uploadId === 'upl_v1')
    expect(cue).toMatchObject({ atMs: 4000, durMs: 2500, volume: 1, kind: 'audio' })
    const tid = trackIdOf(e, 'audio', cue!.generationId)
    expect(e.tracks?.find((t) => t.id === tid)?.name).toMatch(/Voiceover/i)
  })

  it('uses Voiceover 2 when the first track overlaps', () => {
    let e = addVoiceoverClip(base(), 'upl_a', 4000, 3000, () => 'a')
    e = addVoiceoverClip(e, 'upl_b', 5000, 2000, () => 'b')
    const b = e.audio!.sfx.find((s) => s.uploadId === 'upl_b')!
    const tid = trackIdOf(e, 'audio', b.generationId)
    expect(e.tracks?.find((t) => t.id === tid)?.name).toMatch(/Voiceover 2/i)
  })
})

describe('placeRecordedVideo', () => {
  it('insert uses measured duration not 5000 default', () => {
    const e = base()
    const tb = timebaseFor(e)
    const item = vid('upl_cam', 3200)
    const res = placeRecordedVideo(e, tb, item, 'insert', 1000, () => 'ins1')
    expect(res.edits?.inserts?.[0]?.durMs).toBe(3200)
  })

  it('append places at trim out', () => {
    const e = { ...base(), trim: { in: 0, out: 45_000 } }
    const tb = timebaseFor(e)
    const res = placeRecordedVideo(e, tb, vid('upl_a', 2000), 'append', 0, () => 'ins2')
    expect(res.edits?.inserts?.[0]?.append).toBe(true)
    expect(res.edits?.inserts?.[0]?.durMs).toBe(2000)
  })

  it('overlay adds a broll item at playhead', () => {
    const e = base()
    const tb = timebaseFor(e)
    const res = placeRecordedVideo(e, tb, vid('upl_o', 1800), 'overlay', 2000, () => 'br1')
    expect(res.edits?.broll?.[0]).toMatchObject({ uploadId: 'upl_o', startMs: 2000 })
  })
})
