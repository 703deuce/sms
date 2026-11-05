import { describe, expect, it } from 'vitest'
import { normalizeAudioEdits } from '@/lib/clips/audio'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { envelopeFor, addEnvelopePoint, moveEnvelopePoint, envelopePoints } from '@/lib/clips/editor/envelopes'
import {
  addMusicClip,
  clipGainAt,
  duckFactorAt,
  fadeFromDrag,
  fadeGain,
  fitMusicToLength,
  FIT_FADE_OUT_MS,
  musicFadeAt,
  musicMediaMsAt,
  patchAudioClip,
} from '@/lib/clips/editor/audio-clip'
import {
  applyTimelineLaneState,
  buildTimelineItems,
  setLaneState,
  snapTargets,
  timebaseFor,
  trimItem,
  voiceMuted,
} from '@/lib/clips/editor/clip-timeline'
import { addMediaToLane, type ProjectMediaItem } from '@/lib/clips/editor/media-add'
import { applyAudioSolo, normalizeTracks, setTrackFlags, trackIdOf, trackLabel, trackState } from '@/lib/clips/editor/tracks'
import { normalizeTimelineLanes } from '@/lib/clips/editor/timeline-lane-state'

const base = (): ClipEditsV2 => defaultEdits({ clipStartMs: 10_000, clipEndMs: 40_000 })
const withAudio = (audio: Partial<NonNullable<ClipEditsV2['audio']>>): ClipEditsV2 => ({
  ...base(),
  audio: { music: null, sfx: [], ...audio },
})
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

describe('Batch 1 F14 — independent Video opacity and Voice volume envelopes', () => {
  it('renders separate lanes and editing a Voice point leaves Video untouched', () => {
    expect(envelopeFor('video', 'seg:0')).toEqual({ target: 'video', prop: 'opacity' })
    expect(envelopeFor('voice', 'voice')).toEqual({ target: 'voice', prop: 'volume' })
    let edits = base()
    edits = addEnvelopePoint(edits, 'video', 'opacity', 1000, 75)
    edits = addEnvelopePoint(edits, 'voice', 'volume', 1000, 80)
    edits = moveEnvelopePoint(edits, 'voice', 'volume', 1000, 1800, 35)
    expect(envelopePoints(edits, 'video', 'opacity').points).toEqual([{ tMs: 1000, v: 75 }])
    expect(envelopePoints(edits, 'voice', 'volume').points).toEqual([{ tMs: 1800, v: 35 }])
  })
})

describe('G2 audio model (normalize)', () => {
  it('keeps clip fades / ducking and the music loop; drops junk', () => {
    const a = normalizeAudioEdits({
      music: { uploadId: 'upl_m', loop: true },
      sfx: [
        { uploadId: 'upl_a', atMs: 0, fadeInMs: 250.4, fadeOutMs: 99_999, duckDepth: 0.5 },
        { generationId: 'gen_b', atMs: 10, fadeInMs: -3, fadeOutMs: 'x', duckDepth: 7 },
        { generationId: 'gen_c', atMs: 10 },
      ],
    })
    expect(a.music?.loop).toBe(true)
    expect(a.sfx[0]).toMatchObject({ fadeInMs: 250, fadeOutMs: 10_000, duckDepth: 0.5 })
    expect(a.sfx[1]).not.toHaveProperty('fadeInMs')
    expect(a.sfx[1]).not.toHaveProperty('fadeOutMs')
    expect(a.sfx[1]!.duckDepth).toBe(1)
    expect(a.sfx[2]).toEqual({ generationId: 'gen_c', atMs: 10, volume: 0.8 })
    expect(normalizeAudioEdits({ music: { uploadId: 'upl_m', loop: 'yes' } }).music).not.toHaveProperty('loop')
  })
})

describe('G2 fades / ducking math (preview = export)', () => {
  it('linear fades, each at most half the clip', () => {
    const f = { lenMs: 4000, fadeInMs: 1000, fadeOutMs: 1000 }
    expect(fadeGain(0, f)).toBe(0)
    expect(fadeGain(500, f)).toBeCloseTo(0.5)
    expect(fadeGain(2000, f)).toBe(1)
    expect(fadeGain(3500, f)).toBeCloseTo(0.5)
    expect(fadeGain(4000, f)).toBe(0)
    // 1.5 s clip with 2 s fades: 0.75 s each (worker clip_fade clamps the same way).
    expect(fadeGain(375, { lenMs: 1500, fadeInMs: 2000, fadeOutMs: 2000 })).toBeCloseTo(0.5)
  })

  it('music fades: legacy whole-clip bed unclamped, moved window clamped to half', () => {
    const m = { generationId: 'm', fadeInMs: 500, fadeOutMs: 1000 }
    expect(musicFadeAt(m, 250, 10_000)).toBeCloseTo(0.5)
    expect(musicFadeAt(m, 9500, 10_000)).toBeCloseTo(0.5)
    expect(musicFadeAt(m, 5000, 10_000)).toBe(1)
    const w = { ...m, startMs: 2000, endMs: 3000, fadeOutMs: 2000 }
    expect(musicFadeAt(w, 2750, 10_000)).toBeCloseTo(0.5) // out fade = 500 ms (half of 1 s)
    expect(musicFadeAt(w, 1000, 10_000)).toBe(0)
  })

  it('ducking dips by depth while a word is spoken (+ release)', () => {
    const words = [{ s_ms: 1000, e_ms: 2000 }]
    expect(duckFactorAt(500, words, 0.7)).toBe(1)
    expect(duckFactorAt(1500, words, 0.7)).toBeCloseTo(0.3)
    expect(duckFactorAt(2200, words, 0.7)).toBeCloseTo(0.3)
    expect(duckFactorAt(2400, words, 0.7)).toBe(1)
    const g = clipGainAt({ cue: { atMs: 1000, volume: 0.5, fadeInMs: 1000, duckDepth: 0.5 }, localMs: 500, lenMs: 4000, words })
    expect(g).toBeCloseTo(0.5 * 0.5 * 0.5)
    expect(clipGainAt({ cue: { atMs: 0, volume: 0.5 }, localMs: 500, lenMs: 4000, envPct: 50 })).toBeCloseTo(0.25)
  })

  it('fade handle drags never cross and stay in range', () => {
    expect(fadeFromDrag('in', 4000, 0, 0, 600)).toBe(600)
    expect(fadeFromDrag('in', 4000, 0, 3000, 2000)).toBe(1000)
    expect(fadeFromDrag('out', 4000, 1000, 0, 400)).toBe(600) // dragging the out-handle right shortens it
    expect(fadeFromDrag('out', 4000, 1000, 0, -99_999)).toBe(2000) // G2fix: at most half the clip
    expect(fadeFromDrag('in', 4000, 500, 0, -2000)).toBe(0)
  })
})

describe('G2 clip patch / Fit to length / loop', () => {
  it('patches music and clips; SFX ducking can be removed', () => {
    const e = withAudio({ music: { generationId: 'm', volume: 0.25 }, sfx: [{ generationId: 's', atMs: 0, volume: 0.8 }] })
    const a = patchAudioClip(e, 'music', 'm', { fadeInMs: 1500, loop: true, duckDepth: 0 })!
    expect(a.audio?.music).toMatchObject({ fadeInMs: 1500, loop: true, duckDepth: 0 })
    const b = patchAudioClip(a, 'sfx', 's', { fadeOutMs: 700, duckDepth: 0.6, volume: 2 })!
    expect(b.audio?.sfx[0]).toMatchObject({ fadeOutMs: 700, duckDepth: 0.6, volume: 1 })
    const c = patchAudioClip(b, 'sfx', 's', { fadeOutMs: 0, duckDepth: null })!
    expect(c.audio?.sfx[0]).toEqual({ generationId: 's', atMs: 0, volume: 1 })
    expect(patchAudioClip(e, 'sfx', 'nope', { volume: 1 })).toBeNull()
  })

  it('Fit to length: whole video, loop when the song is short, 2 s end fade', () => {
    const e = withAudio({ music: { generationId: 'm', startMs: 4000, endMs: 9000, inMs: 3000, fadeOutMs: 1000 } })
    const short = fitMusicToLength(e, 30_000, 12_000)!.audio!.music!
    expect(short).toMatchObject({ startMs: 0, inMs: 0, loop: true, fadeOutMs: FIT_FADE_OUT_MS })
    expect(short).not.toHaveProperty('endMs')
    const long = fitMusicToLength({ ...e, audio: { ...e.audio!, music: { ...e.audio!.music!, loop: true } } }, 30_000, 200_000)!.audio!.music!
    expect(long).not.toHaveProperty('loop')
    expect(fitMusicToLength(e, 30_000, null)!.audio!.music!.loop).toBe(true)
    expect(fitMusicToLength(withAudio({}), 30_000, 1000)).toBeNull()
  })

  it('a looping bed wraps its media position (preview seek = -stream_loop)', () => {
    const m = { generationId: 'm', loop: true }
    expect(musicMediaMsAt(m, 25_000, 30_000, 12_000)).toBe(1000)
    expect(musicMediaMsAt({ generationId: 'm' }, 25_000, 30_000, 12_000)).toBe(25_000)
  })
})

describe('G2 second song on the Music lane', () => {
  it('never replaces: lands on a "Music 2" track, reused when free, Music 3 when busy', () => {
    const e = base()
    const tb = timebaseFor(e)
    const first = addMediaToLane(e, tb, song('upl_a', 60_000), 'music', 0, () => 'x').edits!
    expect(first.audio?.music?.uploadId).toBe('upl_a')
    const second = addMediaToLane(first, tb, song('upl_b', 8000), 'music', 2000, () => 'x')
    expect(second.edits?.audio?.music?.uploadId).toBe('upl_a')
    expect(second.message).toMatch(/Music 2/)
    const cue = second.edits!.audio!.sfx.find((s) => s.uploadId === 'upl_b')!
    expect(cue).toMatchObject({ atMs: 2000, durMs: 8000, volume: 0.5, fadeInMs: 500, fadeOutMs: 1000, duckDepth: 0.55 })
    const t2 = trackIdOf(second.edits!, 'audio', cue.generationId)
    expect(trackLabel(second.edits!, t2)).toBe('Music 2')
    // Overlapping third song → Music 3; a later one fits back on Music 2.
    const third = addMediaToLane(second.edits!, tb, song('upl_c', 5000), 'music', 4000, () => 'x').edits!
    const c3 = third.audio!.sfx.find((s) => s.uploadId === 'upl_c')!
    expect(trackLabel(third, trackIdOf(third, 'audio', c3.generationId))).toBe('Music 3')
    const fourth = addMediaToLane(third, tb, song('upl_d', 3000), 'music', 20_000, () => 'x').edits!
    const c4 = fourth.audio!.sfx.find((s) => s.uploadId === 'upl_d')!
    expect(trackIdOf(fourth, 'audio', c4.generationId)).toBe(t2)
  })

  it('caps the clip at the video end and refuses a sliver', () => {
    const e = withAudio({ music: { generationId: 'm' } })
    const r = addMusicClip(e, { generationId: 'b', uploadId: 'b', atMs: 25_000, lenMs: 60_000, durationMs: 30_000 })!
    expect(r.edits.audio!.sfx[0]!.durMs).toBe(5000)
    expect(addMusicClip(e, { generationId: 'b', uploadId: 'b', atMs: 29_950, lenMs: 60_000, durationMs: 30_000 })).toBeNull()
  })
})

describe('G2 audio clip trim', () => {
  it('left edge advances the in-point, right edge sets the play length (≤ media)', () => {
    const e = withAudio({ sfx: [{ generationId: 's', atMs: 1000, volume: 0.8, durMs: 4000 }] })
    const ctx = { edits: e, previewEdits: e, sfxDurationsMs: { s: 6000 } }
    const it = buildTimelineItems({ edits: e, previewEdits: e, sfxDurationsMs: { s: 6000 } }).sfx[0]!
    expect(it.caps.trimStart && it.caps.trimEnd).toBe(true)
    const l = trimItem(ctx, { lane: 'sfx', id: 's' }, 'start', 1500)!
    expect(l.audio!.sfx[0]).toMatchObject({ atMs: 1500, inMs: 500, durMs: 3500 })
    const r = trimItem(ctx, { lane: 'sfx', id: 's' }, 'end', 99_000)!
    expect(r.audio!.sfx[0]!.durMs).toBe(6000)
    // In-point 0: there is no earlier media to pull in.
    expect(trimItem(ctx, { lane: 'sfx', id: 's' }, 'start', 0)).toBeNull()
  })
})

describe('G2 solo', () => {
  const tracks = [
    { id: 'ov1', kind: 'overlay' },
    { id: 'tx1', kind: 'text' },
    { id: 'au1', kind: 'audio' },
    { id: 'au2', kind: 'audio', items: ['s2'] },
  ] as const
  const e = (): ClipEditsV2 => ({
    ...withAudio({ music: { generationId: 'm' }, sfx: [{ generationId: 's1', atMs: 0 }, { generationId: 's2', atMs: 0 }] }),
    tracks: normalizeTracks(tracks),
  })

  it('normalizers keep solo on audio lanes / tracks only', () => {
    expect(normalizeTimelineLanes({ music: { soloed: true }, text: { soloed: true } })).toEqual({ music: { soloed: true } })
    const ts = normalizeTracks([...tracks, { id: 'ov2', kind: 'overlay', soloed: true }, { id: 'au3', kind: 'audio', soloed: true }])!
    expect(ts.find((t) => t.id === 'ov2')).not.toHaveProperty('soloed')
    expect(ts.find((t) => t.id === 'au3')?.soloed).toBe(true)
    const flagged = setTrackFlags(e(), 'au2', { soloed: true })!
    expect(trackState(flagged, 'au2').soloed).toBe(true)
  })

  it('soloing Music silences voice, SFX and the extra track (preview and export paths)', () => {
    const s = setLaneState(e(), 'music', { soloed: true })
    expect(voiceMuted(s)).toBe(true)
    const r = applyTimelineLaneState(s)
    expect(r.audio?.music?.generationId).toBe('m')
    expect(r.audio?.sfx).toEqual([])
    expect(applyAudioSolo(e())).toEqual(e())
  })

  it('soloing an extra track keeps only that track', () => {
    const s = setTrackFlags(e(), 'au2', { soloed: true })!
    const r = applyTimelineLaneState(s)
    expect(r.audio?.music).toBeNull()
    expect(r.audio?.sfx.map((x) => x.generationId)).toEqual(['s2'])
    expect(voiceMuted(s)).toBe(true)
  })
})

describe('G2 beat snapping', () => {
  it('beats join the snap targets', () => {
    const e = base()
    const lanes = buildTimelineItems({ edits: e, previewEdits: e })
    expect(snapTargets({ lanes, durationMs: 30_000, playheadMs: 0, beatsMs: [1234.4, 5000] })).toEqual(expect.arrayContaining([1234, 5000]))
  })
})
