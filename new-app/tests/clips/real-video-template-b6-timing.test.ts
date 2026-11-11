import { describe, expect, it } from 'vitest'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  TEMPLATE_TRANSITION_TYPES,
  TEMPLATE_UNAVAILABLE_TRANSITION_TYPES,
  compileTemplatePrototype,
  type TemplateAsset,
  type TemplateChoices,
} from '@/lib/clips/real-video-templates/sequence-contract'
import {
  compileTemplatePlayback,
  playbackRequiredHandleFrames,
  sampleTemplatePlayback,
} from '@/lib/clips/real-video-templates/slot-playback'
import { outputToSequenceFrame, sourceToSequenceFrames } from '@/lib/clips/real-video-templates/sequence-timebase'
import { segmentMediaMs, sourceSegmentPlaybackRate } from '@/lib/clips/editor/sources'

const asset = (id: string, kind: 'image' | 'video' | 'audio', frames = 180): TemplateAsset => ({
  id,
  kind,
  ...(kind === 'image' ? {} : { durationFrames: frames }),
  license: { id: 'license_1', provenance: 'user-owned', reference: 'library_1' },
})
const carrier = {
  durationFrames: 30,
  edits: {
    v: 2,
    trim: { in: 0, out: 1000 },
    cutRanges: [],
    wordFixes: {},
    captions: {},
    layout: { mode: 'full_frame', shotOverrides: [] },
  } as ClipEditsV2,
}
const design = {
  schemaVersion: 1,
  designId: 'design_b6',
  revision: 1,
  stylePackId: 'style_b6',
  familyId: 'family_b6',
  familyRevision: 1,
  musicPolicy: 'licensed-only',
}
const playbackSpec = {
  pieces: [
    { kind: 'play', frames: 5, rate: 0.5 },
    { kind: 'hold', frames: 3 },
    { kind: 'curve', frames: 7, curve: 'ramp_up' },
  ],
}

const family = {
  schemaVersion: 1,
  familyId: 'family_b6',
  revision: 1,
  title: 'B6 playback proof',
  tags: ['beat'],
  aspects: ['9:16'],
  fps: 30,
  totalFrames: 30,
  slots: [
    {
      id: 'shot_1',
      ordinal: 1,
      role: 'hero',
      media: 'video',
      startFrame: 0,
      durationFrames: 15,
      sourceInFrame: 24,
      handles: { headFrames: 8, tailFrames: 8 },
      fit: 'cover',
      sourceAudio: 'source',
      playback: playbackSpec,
      transition: 'cut',
      transform: { scale: 112, x: 4 },
      fx: { contrast: 8 },
    },
    {
      id: 'shot_2',
      ordinal: 2,
      role: 'closing',
      media: 'video',
      startFrame: 15,
      durationFrames: 15,
      sourceInFrame: 20,
      handles: { headFrames: 8, tailFrames: 0 },
      fit: 'contain',
      sourceAudio: 'mute',
      transition: { type: 'crossfade', durationFrames: 6 },
    },
  ],
  texts: [{
    id: 'headline',
    defaultText: 'Output clock stays put',
    maxChars: 80,
    startFrame: 0,
    durationFrames: 30,
    x: 50,
    y: 20,
    font: 'Montserrat',
    size: 58,
    color: '#FFFFFF',
  }],
  graphics: [{
    id: 'bar',
    type: 'rect',
    startFrame: 0,
    durationFrames: 30,
    x: 50,
    y: 80,
    w: 50,
    h: 4,
    color: '#FFFFFF',
  }],
  beatAnchors: [0, 15],
}
const choices: TemplateChoices = {
  instanceId: 'instance_b6',
  media: {
    shot_1: asset('video_a', 'video'),
    shot_2: asset('video_b', 'video'),
  },
  music: asset('music_b6', 'audio', 240),
}

describe('real-video template B6 slot-local playback', () => {
  it('expands a speed curve + freeze into one exact output-frame plan', () => {
    const plan = compileTemplatePlayback(playbackSpec, 15)
    expect(plan.outputFrames).toBe(15)
    expect(plan.pieces.reduce((n, p) => n + p.frames, 0)).toBe(15)
    expect(sampleTemplatePlayback(plan, 24, 5).mediaFrame).toBe(sampleTemplatePlayback(plan, 24, 7).mediaFrame)
    expect(sampleTemplatePlayback(plan, 24, 5).held).toBe(true)
    expect(playbackRequiredHandleFrames(plan, 'tail', 3)).toBeGreaterThan(0)
  })

  it('compiles the plan into ClipEditsV2 without moving text/graphics/music', () => {
    const result = compileTemplatePrototype(family, design, choices, carrier)
    const first = result.edits.sourceSegments?.[0]
    expect(first?.playback?.outputFrames).toBe(15)
    expect(first?.speed).toBeUndefined()
    expect(first?.transform).toEqual({ scale: 112, x: 4 })
    expect(first?.fx).toEqual({ contrast: 8 })
    expect(result.edits.transitions).toEqual([{ srcMs: 500, type: 'crossfade', durMs: 200 }])
    expect(result.edits.textItems?.[0]).toMatchObject({ startMs: 0, endMs: 1000 })
    expect(result.edits.textItems?.[1]).toMatchObject({ startMs: 0, endMs: 1000 })
    expect(result.edits.audio?.music).toMatchObject({ startMs: 0, endMs: 1000, loop: true })
    expect(result.sequence.items[0]?.playback?.outputFrames).toBe(15)

    const heldA = outputToSequenceFrame(result.sequence, 5).mediaFrame
    const heldB = outputToSequenceFrame(result.sequence, 7).mediaFrame
    expect(heldA).toBe(heldB)
    const repeated = sourceToSequenceFrames(result.sequence, 'video_a', heldA)
    expect(repeated.map((x) => x.outputFrame)).toEqual([4, 5, 6, 7])
    expect(segmentMediaMs(first!, result.edits.sources?.[0], 200)).toBeGreaterThanOrEqual(0)
    expect(sourceSegmentPlaybackRate(first!, result.edits.sources?.[0], 200)).toBe(0)
  })

  it('keeps shader variants explicit and rejects unproven catalog variants', () => {
    expect(TEMPLATE_TRANSITION_TYPES).toEqual(expect.arrayContaining(['crossfade','dip_white','zoom_blur','whip_pan','glitch']))
    expect(TEMPLATE_UNAVAILABLE_TRANSITION_TYPES).toEqual(expect.arrayContaining(['dip_black','zoom_in','blur']))
  })

  it('fails fast instead of truncating insufficient source media', () => {
    const short: TemplateChoices = {
      ...choices,
      media: { ...choices.media, shot_1: asset('short_a', 'video', 30) },
    }
    expect(() => compileTemplatePrototype(family, design, short, carrier)).toThrow(/video too short/)
  })

  it('does not allow playback plans on photo assignments', () => {
    const photoFamily = structuredClone(family)
    photoFamily.slots[0].media = 'either'
    const photoChoices: TemplateChoices = {
      ...choices,
      media: { ...choices.media, shot_1: asset('photo_a', 'image') },
    }
    expect(() => compileTemplatePrototype(photoFamily, design, photoChoices, carrier)).toThrow(/playback speed requires video media/)
  })
})
