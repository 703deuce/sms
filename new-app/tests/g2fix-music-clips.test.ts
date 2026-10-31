import { describe, expect, it } from 'vitest'
import { normalizeAudioEdits } from '@/lib/clips/audio'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import {
  clipPlayLenMs,
  fadeDragMsPerPx,
  fadeFromDrag,
  FADE_DRAG_MAX_MS_PER_PX,
  fitClipToLength,
  maxFadeMs,
  patchAudioClip,
} from '@/lib/clips/editor/audio-clip'
import { audioClipKind, audioClipKindOf } from '@/lib/clips/editor/audio-kind'
import { buildTimelineItems, timebaseFor, trimItem } from '@/lib/clips/editor/clip-timeline'
import { addMediaToLane, placeAddedOnTrack, type ProjectMediaItem } from '@/lib/clips/editor/media-add'
import { detachBrollAudio, splitStereoToTracks } from '@/lib/clips/editor/timeline-edit-ops'
import { addTrack, setItemsTrack, trackIdOf } from '@/lib/clips/editor/tracks'

const base = (): ClipEditsV2 => defaultEdits({ clipStartMs: 10_000, clipEndMs: 40_000 }) // 30 s
const song = (refId: string, durationMs: number): ProjectMediaItem => ({
  id: refId,
  ref: 'upload',
  refId,
  mediaType: 'audio',
  label: `${refId}.mp3`,
  durationMs,
  width: null,
  height: null,
  url: 'https://x/y',
  syncMs: null,
  syncStatus: 'none',
})
const twoSongs = () => {
  const e = base()
  const tb = timebaseFor(e)
  const first = addMediaToLane(e, tb, song('upl_a', 60_000), 'music', 0, () => 'x').edits!
  return { tb, edits: addMediaToLane(first, tb, song('upl_b', 12_000), 'music', 2000, () => 'x').edits! }
}

describe('G2fix: songs on Music N tracks are music clips', () => {
  it('Music button: the 2nd song is kind music, labelled Music, ducked with music defaults', () => {
    const { edits } = twoSongs()
    const cue = edits.audio!.sfx[0]!
    expect(cue).toMatchObject({ kind: 'music', volume: 0.25, fadeInMs: 500, fadeOutMs: 1000, duckDepth: 0.7 })
    expect(audioClipKindOf(edits, cue.generationId)).toBe('music')
    const item = buildTimelineItems({ edits, previewEdits: edits }).sfx[0]!
    expect(item.label).toBe('Music')
  })

  it('drag-and-drop onto a Music N track also makes a music clip; the default SFX lane does not', () => {
    const { tb, edits } = twoSongs()
    const music2 = trackIdOf(edits, 'audio', edits.audio!.sfx[0]!.generationId)
    const dropped = addMediaToLane(edits, tb, song('upl_c', 20_000), 'sfx', 15_000, () => 'x').edits!
    const onMusic = placeAddedOnTrack(edits, dropped, 'sfx', music2)
    const c = onMusic.audio!.sfx.find((s) => s.uploadId === 'upl_c')!
    expect(c).toMatchObject({ kind: 'music', volume: 0.25, duckDepth: 0.7, fadeInMs: 500 })
    // Dropped on the plain SFX lane: an SFX, no ducking by default.
    const plain = placeAddedOnTrack(edits, dropped, 'sfx', undefined).audio!.sfx.find((s) => s.uploadId === 'upl_c')!
    expect(plain.kind).toBeUndefined()
    expect(plain.duckDepth).toBeUndefined()
    expect(audioClipKind(edits, plain)).toBe('sfx')
  })

  it('legacy G2 saves: a plain cue on a "Music 2" track reads as music (no migration needed)', () => {
    let e: ClipEditsV2 = { ...base(), audio: { music: null, sfx: [{ generationId: 'upl_x', uploadId: 'upl_x', atMs: 0, volume: 0.25, durMs: 30_000 }] } }
    const t = addTrack(e, 'audio', { name: 'Music 2' })!
    e = setItemsTrack(t.edits, 'audio', ['upl_x'], t.trackId)!
    expect(audioClipKindOf(e, 'upl_x')).toBe('music')
    expect(buildTimelineItems({ edits: e, previewEdits: e }).sfx[0]!.label).toBe('Music')
    // Round-trips through the normalizer with the new keys.
    const a = normalizeAudioEdits({ music: null, sfx: [{ uploadId: 'u', atMs: 0, kind: 'music', loop: true, durMs: 5000 }, { uploadId: 'v', atMs: 0, kind: 'bogus', loop: true }] })
    expect(a.sfx[0]).toMatchObject({ kind: 'music', loop: true })
    expect(a.sfx[1]).not.toHaveProperty('kind')
    expect(a.sfx[1]).not.toHaveProperty('loop') // loop needs a length
  })

  it('labels: detached / split clip audio is "Audio", short cues stay "SFX"', () => {
    const e: ClipEditsV2 = {
      ...base(),
      broll: [{ id: 'b1', source: 'upload', uploadId: 'upl_v', startMs: 1000, endMs: 21_000, placement: 'manual' }],
      audio: { music: null, sfx: [{ generationId: 'pop', atMs: 0, volume: 0.8 }] },
    }
    const det = detachBrollAudio(e, 'b1')!
    expect(det.edits.audio!.sfx.find((s) => s.generationId === det.id)!.kind).toBe('audio')
    const split = splitStereoToTracks(e, 'broll', 'b1')!
    const labels = buildTimelineItems({ edits: split.edits, previewEdits: split.edits }).sfx.map((i) => i.label)
    expect(labels).toEqual(['SFX', 'Audio', 'Audio'])
    // Legacy split L/R cue (no kind): still "Audio".
    expect(audioClipKind(e, { generationId: 'q', channel: 'L' })).toBe('audio')
  })
})

describe('G2fix: music-clip Loop / Fit to length (export = preview)', () => {
  it('Fit to length on a short song: 0 → end of video, loops, 2 s end fade; long song: trimmed, no loop', () => {
    const { edits } = twoSongs()
    const id = edits.audio!.sfx[0]!.generationId
    const fit = fitClipToLength(edits, id, 30_000, 12_000)!
    expect(fit.audio!.sfx[0]).toMatchObject({ atMs: 0, durMs: 30_000, loop: true, fadeOutMs: 2000 })
    expect(fit.audio!.sfx[0]).not.toHaveProperty('inMs')
    const item = buildTimelineItems({ edits: fit, previewEdits: fit, sfxDurationsMs: { [id]: 12_000 } }).sfx[0]!
    expect([item.startMs, item.endMs]).toEqual([0, 30_000]) // looping: whole durMs, not the 12 s media
    expect(clipPlayLenMs(fit.audio!.sfx[0]!, 12_000)).toBe(30_000)
    const long = fitClipToLength(edits, id, 30_000, 900_000)!
    expect(long.audio!.sfx[0]).toMatchObject({ atMs: 0, durMs: 30_000, fadeOutMs: 2000 })
    expect(long.audio!.sfx[0]).not.toHaveProperty('loop')
  })

  it('Loop toggle needs a length (takes the clip length) and a looping clip trims past its media', () => {
    const e: ClipEditsV2 = { ...base(), audio: { music: null, sfx: [{ generationId: 'u', uploadId: 'u', atMs: 0, volume: 0.25, kind: 'music' }] } }
    expect(patchAudioClip(e, 'sfx', 'u', { loop: true })).toBeNull()
    const on = patchAudioClip(e, 'sfx', 'u', { loop: true, durMs: 8000 })!
    expect(on.audio!.sfx[0]).toMatchObject({ loop: true, durMs: 8000 })
    const ctx = { edits: on, previewEdits: on, sfxDurationsMs: { u: 8000 } }
    const longer = trimItem(ctx, { lane: 'sfx', id: 'u' }, 'end', 20_000)!
    expect(longer.audio!.sfx[0]!.durMs).toBe(20_000)
    const off = patchAudioClip(on, 'sfx', 'u', { loop: false })!
    expect(off.audio!.sfx[0]).not.toHaveProperty('loop')
  })
})

describe('G2fix: fade drag scaling', () => {
  it('ms per px follows the zoom, capped when zoomed out; fades max min(clip/2, 10 s)', () => {
    expect(fadeDragMsPerPx(0.1)).toBe(10) // zoomed in: the handle follows the pointer
    expect(fadeDragMsPerPx(0.0014)).toBe(FADE_DRAG_MAX_MS_PER_PX) // 1 % zoom (~700 ms/px) → 50 ms/px
    expect(fadeDragMsPerPx(0.0014, true)).toBe(10)
    // The live-check case: 15 px at 1 % zoom on a long clip moves the fade 0.75 s, not to the cap.
    expect(fadeFromDrag('out', 715_740, 1000, 500, -15 * fadeDragMsPerPx(0.0014))).toBe(1750)
    expect(maxFadeMs(4000)).toBe(2000)
    expect(maxFadeMs(600_000)).toBe(10_000)
    expect(fadeFromDrag('in', 4000, 0, 0, 99_999)).toBe(2000)
  })
})
