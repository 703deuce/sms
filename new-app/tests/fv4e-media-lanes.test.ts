import { describe, expect, it } from 'vitest'
import { addMediaToLane, mediaDropLanesFor, mediaLanesFor, type ProjectMediaItem } from '@/lib/clips/editor/media-add'
import { buildFromTranscriptItem } from '@/lib/clips/editor/source-monitor'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'

const item = (p: Partial<ProjectMediaItem>): ProjectMediaItem => ({
  id: 'lib_1',
  ref: 'upload',
  refId: 'upl_1',
  mediaType: 'video',
  label: 'cam2.mp4',
  durationMs: 180_000,
  width: 1920,
  height: 1080,
  url: 'https://b2.example/cam2.mp4',
  syncMs: null,
  syncStatus: 'none',
  ...p,
})

const bounds = { clipStartMs: 0, clipEndMs: 60_000 }

describe('FV4e video upload on the Music / SFX lanes (drop)', () => {
  it('card buttons unchanged; drop lanes add music + sfx for uploaded video only', () => {
    expect(mediaLanesFor(item({}))).toEqual(['video', 'broll'])
    expect(mediaDropLanesFor(item({}))).toEqual(['video', 'broll', 'music', 'sfx'])
    expect(mediaDropLanesFor(item({ ref: 'take' }))).toEqual(['video'])
    expect(mediaDropLanesFor(item({ isMain: true }))).toEqual([])
    expect(mediaDropLanesFor(item({ mediaType: 'image' }))).toEqual(['video', 'broll'])
    expect(mediaDropLanesFor(item({ mediaType: 'audio' }))).toEqual(['music', 'sfx'])
  })

  it('dropping a video upload on Music sets it as the music track (its sound)', () => {
    const edits = normalizeEdits(defaultEdits(bounds), bounds)
    const tb = timebaseFor(edits)
    const res = addMediaToLane(edits, tb, item({}), 'music', 0, () => 'id1')
    expect(res.edits).not.toBeNull()
    expect(res.edits!.audio?.music?.uploadId).toBe('upl_1')
    const sfx = addMediaToLane(edits, tb, item({}), 'sfx', 1000, () => 'id2')
    const cues = sfx.edits!.audio?.sfx ?? []
    expect(cues[cues.length - 1]?.uploadId).toBe('upl_1')
  })

  it('images still can not go on Music', () => {
    const edits = normalizeEdits(defaultEdits(bounds), bounds)
    const res = addMediaToLane(edits, timebaseFor(edits), item({ mediaType: 'image' }), 'music', 0, () => 'x')
    expect(res.edits).toBeNull()
  })
})

describe('FV4e Build from transcript target', () => {
  const main = item({ id: 'main', isMain: true, refId: 'upl_main' })
  const noTr = item({ id: 'a', refId: 'upl_a' })
  const withTr = item({ id: 'b', refId: 'upl_b', mediaType: 'audio' })
  const img = item({ id: 'c', refId: 'upl_c', mediaType: 'image' })
  it('prefers an upload with a finished transcript, never the main video or images', () => {
    expect(buildFromTranscriptItem([main, img, noTr, withTr], [{ ref: 'upload', refId: 'upl_b', status: 'done' }])?.id).toBe('b')
    expect(buildFromTranscriptItem([main, img, noTr, withTr], [{ ref: 'upload', refId: 'upl_b', status: 'queued' }])?.id).toBe('a')
    expect(buildFromTranscriptItem([main, img], undefined)).toBeNull()
  })
})
