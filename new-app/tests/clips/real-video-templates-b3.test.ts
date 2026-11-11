import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileTemplatePrototype, validateTemplateFamily, type TemplateChoices, type TemplateAsset, type TemplateFamilyV1, type TemplateSlot } from '@/lib/clips/real-video-templates/sequence-contract'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { outputToSequenceFrame, itemLocalToSequenceFrame, sourceToSequenceFrames, frameToMs } from '@/lib/clips/real-video-templates/sequence-timebase'
import { clearSourceRange } from '@/lib/clips/editor/sources'

const slot = (n: number, frames = 30): TemplateSlot => ({
  id: `shot_${n}`, ordinal: n, role: 'hero', media: 'either',
  startFrame: (n - 1) * frames, durationFrames: frames, fit: 'cover',
  sourceAudio: 'mute', transition: 'cut',
})
const family = (count: number): TemplateFamilyV1 => ({
  schemaVersion: 1, familyId: 'family_a', revision: 2, title: 'Sequence proof',
  tags: ['story'], aspects: ['9:16'], fps: 30, totalFrames: count * 30,
  slots: Array.from({ length: count }, (_, i) => slot(i + 1)),
  texts: [{ id: 'headline', defaultText: 'Across every shot', maxChars: 100,
    startFrame: 0, durationFrames: count * 30, x: 50, y: 20,
    font: 'Montserrat', size: 60, color: '#FFFFFF' }],
  beatAnchors: [],
})
const design = { schemaVersion: 1, designId: 'design_a', revision: 3,
  stylePackId: 'style_a', familyId: 'family_a', familyRevision: 2, musicPolicy: 'licensed-only' }
const asset = (id: string, kind: 'image' | 'video' | 'audio', frames = 90): TemplateAsset => ({
  id, kind, ...(kind === 'image' ? {} : { durationFrames: frames }),
  license: { id: 'license_1', provenance: 'user-owned', reference: 'library_1' },
})
const carrier = (count: number) => ({
  durationFrames: count * 30,
  edits: { v: 2, trim: { in: 0, out: count * 1000 }, cutRanges: [],
    wordFixes: {}, captions: {}, layout: { mode: 'full_frame', shotOverrides: [] } } as ClipEditsV2,
})
const choices = (count: number): TemplateChoices => ({
  instanceId: 'instance_a',
  media: Object.fromEntries(Array.from({ length: count }, (_, i) =>
    [`shot_${i + 1}`, asset('image_one', 'image')])),
  music: asset('music_one', 'audio'),
})
describe('real-video template B3 production contract', () => {
  it('compiles 30 ordered slots without inserts and holds text/music end-to-end', () => {
    const r = compileTemplatePrototype(family(30), design, choices(30), carrier(30))
    expect(r.renderable).toBe(true)
    expect(r.sequence.items).toHaveLength(30)
    expect(r.sequence.totalFrames).toBe(900)
    expect(r.sequence.items[29].outputEndFrame).toBe(900)
    expect(r.edits.inserts).toBeUndefined()
    expect(r.edits.sourceSegments).toHaveLength(30)
    expect(r.edits.textItems?.[0]).toMatchObject({ startMs: 0, endMs: 30000 })
    expect(r.edits.audio?.music).toMatchObject({ startMs: 0, endMs: 30000, loop: true })
    expect(new Set(r.edits.sources?.map(s => s.id)).size).toBe(1)
  })
  it('emits real editable slot clips with cross-source transitions and transforms', () => {
    const f = family(2)
    f.slots[0] = {
      ...f.slots[0]!,
      media: 'video',
      handles: { headFrames: 0, tailFrames: 15 },
      transform: { scale: 110, cropR: 4 },
      fx: { contrast: 12 },
    }
    f.slots[1] = {
      ...f.slots[1]!,
      media: 'video',
      sourceInFrame: 15,
      handles: { headFrames: 15, tailFrames: 0 },
      transition: { type: 'crossfade', durationFrames: 30 },
      transform: { x: 6, y: -3, scale: 105 },
      fx: { brightness: 5, saturation: -8 },
    }
    const c = choices(2)
    c.media.shot_1 = asset('video_a', 'video', 90)
    c.media.shot_2 = asset('video_b', 'video', 90)

    const r = compileTemplatePrototype(f, design, c, carrier(2))
    expect(r.renderable).toBe(true)
    expect(r.edits.videoSplits).toEqual([1000])
    expect(r.edits.transitions).toEqual([{ srcMs: 1000, type: 'crossfade', durMs: 1000 }])
    expect(r.edits.sourceSegments).toHaveLength(2)
    expect(r.edits.sourceSegments?.[0]).toMatchObject({
      id: r.slotToItemIds.shot_1,
      startMs: 0,
      endMs: 1000,
      transform: { scale: 110, cropR: 4 },
      fx: { contrast: 12 },
    })
    expect(r.edits.sourceSegments?.[1]).toMatchObject({
      id: r.slotToItemIds.shot_2,
      startMs: 1000,
      endMs: 2000,
      inMs: 500,
      transform: { x: 6, y: -3, scale: 105 },
      fx: { brightness: 5, saturation: -8 },
    })
    expect(r.edits.textItems?.[0]).toMatchObject({ startMs: 0, endMs: 2000 })
    expect(r.edits.audio?.music).toMatchObject({ startMs: 0, endMs: 2000, loop: true })
    expect(r.edits.inserts).toBeUndefined()
    expect(r.edits.templateProvenance?.slotToItemIds).toEqual(r.slotToItemIds)
  })

  it('requires real source handles for cross-source transitions instead of degrading to cuts', () => {
    const f = family(2)
    f.slots[1] = {
      ...f.slots[1]!,
      transition: { type: 'crossfade', durationFrames: 30 },
    }
    expect(() => validateTemplateFamily(f)).toThrow(/requires source handles \(left 15, right 15 frames\)/)
  })


  it('keeps authored output duration while mapping per-slot source speed through preview/export clocks', () => {
    const f = family(2)
    f.slots[0] = { ...f.slots[0]!, media: 'video', speed: 1.5 }
    f.slots[1] = { ...f.slots[1]!, media: 'video', speed: 0.5 }
    const c = choices(2)
    c.media.shot_1 = asset('speed_a', 'video', 90)
    c.media.shot_2 = asset('speed_b', 'video', 90)
    const r = compileTemplatePrototype(f, design, c, carrier(2))
    expect(r.edits.trim).toEqual({ in: 0, out: 2000 })
    expect(r.edits.sourceSegments?.map((seg) => seg.speed)).toEqual([1.5, 0.5])
    expect(r.sequence.items.map((item) => item.speed)).toEqual([1.5, 0.5])
    const first = outputToSequenceFrame(r.sequence, 20)
    expect(first.mediaFrame).toBe(30)
    const second = outputToSequenceFrame(r.sequence, 40)
    expect(second.itemLocalFrame).toBe(10)
    expect(second.mediaFrame).toBe(5)
    const split = clearSourceRange(r.edits.sourceSegments, 0, 200)
    expect(split?.[0]).toMatchObject({ startMs: 200, inMs: 300, speed: 1.5 })
  })

  it('rejects playback speed on still-image slots', () => {
    const f = family(1)
    f.slots[0] = { ...f.slots[0]!, speed: 2 }
    expect(() => validateTemplateFamily(f)).toThrow(/images do not support playback speed/)
  })

  it('is deterministic, including source reuse and stable slot IDs', () => {
    const a = compileTemplatePrototype(family(2), design, choices(2), carrier(2))
    const b = compileTemplatePrototype(family(2), design, choices(2), carrier(2))
    expect(a).toEqual(b)
    expect(a.sequence.items[0].id).not.toBe(a.sequence.items[1].id)
  })
  it('maps fixed-duration slot speed through compiler and exact frame clock', () => {
    const f = family(1)
    f.slots[0] = { ...f.slots[0]!, media: 'video', sourceInFrame: 15, speed: 2 }
    const c = choices(1)
    c.media.shot_1 = asset('video_speed', 'video', 90)
    const r = compileTemplatePrototype(f, design, c, carrier(1))
    expect(r.edits.sourceSegments?.[0]).toMatchObject({ inMs: 500, speed: 2, startMs: 0, endMs: 1000 })
    expect(r.sequence.items[0]).toMatchObject({ mediaInFrame: 15, speed: 2 })
    const loc = outputToSequenceFrame(r.sequence, 10)
    expect(loc).toMatchObject({ outputFrame: 10, itemLocalFrame: 10, mediaFrame: 35 })
    expect(sourceToSequenceFrames(r.sequence, 'video_speed', 35)).toEqual([loc])
    expect(sourceToSequenceFrames(r.sequence, 'video_speed', 36)).toHaveLength(0)
  })

  it('accepts photos alone, and a mixed photo/video arrangement', () => {
    const c = choices(2)
    c.media.shot_2 = asset('video_two', 'video', 60)
    const r = compileTemplatePrototype(family(2), design, c, carrier(2))
    expect(r.edits.sources?.map(s => s.mediaType)).toEqual(['image', 'video'])
  })
  it('rejects video overflow with remedy rather than truncating', () => {
    const c = choices(1)
    c.media.shot_1 = asset('short_video', 'video', 15)
    expect(() => compileTemplatePrototype(family(1), design, c, carrier(1)))
      .toThrow(/video too short for required handles/)
  })
  it('rejects unsupported operations, unknown fields, overlaps and invalid text', () => {
    expect(() => validateTemplateFamily({ ...family(1), script: 'alert(1)' })).toThrow(/unsupported field/)
    expect(() => validateTemplateFamily({ ...family(1), slots: [{ ...slot(1), transition: 'dissolve' }] }))
      .toThrow(/unsupported capability/)
    expect(() => validateTemplateFamily({ ...family(2), slots: [slot(1), { ...slot(2), startFrame: 10 }] }))
      .toThrow(/gap\/overlap/)
    expect(() => compileTemplatePrototype(family(1), design,
      { ...choices(1), texts: { headline: 'x'.repeat(101) } }, carrier(1))).toThrow(/limit 100/)
  })
  it('fails closed on unsupported music rights and missing carrier frame budget', () => {
    expect(() => compileTemplatePrototype(family(1), { ...design, musicPolicy: 'none' }, choices(1), carrier(1)))
      .toThrow(/music forbidden/)
    expect(() => compileTemplatePrototype(family(1), design, choices(1), carrier(2)))
      .toThrow(/exact frame count/)
  })
})

describe('B3 exact source/output/item-local frame clock', () => {
  it('round-trips every frame and preserves repeated source ambiguity', () => {
    const seq = compileTemplatePrototype(family(30), design, choices(30), carrier(30)).sequence
    for (let output = 0; output < seq.totalFrames; output++) {
      const location = outputToSequenceFrame(seq, output)
      expect(itemLocalToSequenceFrame(seq, location.itemId, location.itemLocalFrame)).toEqual(location)
      const matching = sourceToSequenceFrames(seq, location.sourceId, location.mediaFrame)
      expect(matching).toContainEqual(location)
    }
    expect(sourceToSequenceFrames(seq, 'image_one', 0)).toHaveLength(30)
    expect(frameToMs(900)).toBe(30000)
    expect(() => outputToSequenceFrame(seq, 900)).toThrow(/outside sequence/)
    expect(() => itemLocalToSequenceFrame(seq, 'unknown', 0)).toThrow(/unknown sequence item/)
  })
})

// Server-side ownership/CAS regression is also in the explicit editor CI test gate.
import './real-video-template-instance.test'

describe('B3 source audio and absent legacy controls', () => {
  it('keeps a single image first project possible without any video upload or ASR', () => {
    const r = compileTemplatePrototype(family(1), design, choices(1), carrier(1))
    expect(r.edits.sources?.[0]?.mediaType).toBe('image')
    expect(r.edits.sources).toHaveLength(1)
    expect(r.edits.sourceSegments).toHaveLength(1)
    expect(r.edits.trim).toEqual({ in: 0, out: 1000 })
  })
  it('maps source/mute audio per slot without inventing speech on silent carrier', () => {
    const f = family(2)
    f.slots[0].media = 'video'
    f.slots[0].sourceAudio = 'source'
    f.slots[1].media = 'video'
    f.slots[1].sourceAudio = 'mute'
    const c = choices(2)
    c.media.shot_1 = asset('video_a', 'video')
    c.media.shot_2 = asset('video_a', 'video')
    const r = compileTemplatePrototype(f, design, c, carrier(2))
    expect(r.edits.sourceSegments?.map(s => s.audio)).toEqual(['source', 'main'])
    expect(r.sequence.items.map(x => x.sourceAudio)).toEqual(['source', 'mute'])
  })
  it('does not add sequence metadata or inserts to untouched existing edits', async () => {
    const { defaultEdits, normalizeEdits, canonicalEditsJson } = await import('@/lib/clips/edits')
    const bounds = { clipStartMs: 0, clipEndMs: 30000 }
    const old = defaultEdits(bounds)
    const original = canonicalEditsJson(normalizeEdits(old, bounds))
    compileTemplatePrototype(family(1), design, choices(1), carrier(1))
    expect(canonicalEditsJson(normalizeEdits(old, bounds))).toBe(original)
    expect('templateSequence' in normalizeEdits(old, bounds)).toBe(false)
    expect('inserts' in normalizeEdits(old, bounds)).toBe(false)
  })
})

describe('B3 production editor sequence adapter', () => {
  it('exposes every compiled slot through both existing editor timelines without flattening', () => {
    const fullTimeline = readFileSync(join(process.cwd(), 'components/clips/editor/timeline.tsx'), 'utf8')
    const compactTimeline = readFileSync(join(process.cwd(), 'components/clips/editor/script-view-compact-timeline.tsx'), 'utf8')
    const preview = readFileSync(join(process.cwd(), 'components/clips/editor/preview-stage.tsx'), 'utf8')

    expect(fullTimeline).toContain('data-testid="timeline-source-segment"')
    expect(fullTimeline).toContain('onSelectSourceSegment?.(c.id)')
    expect(compactTimeline).toContain('data-testid="script-compact-source-segment"')
    expect(compactTimeline).toContain('onSelectSourceSegment?.(chip.id)')
    expect(preview).toContain('sourceFrameAt:')
    expect(preview).toContain('segmentMediaMs(seg, source, targetSrcMs)')
  })
})

// CI uses this scoped actual compiler run instead of relying on a green Vitest transpile.
import './real-video-template-typecheck.test'

describe('B3 production slot edit representation', () => {
  it('compiles cross-source transitions, transforms, FX and graphics as ordinary editable edit records', () => {
    const f = family(2)
    f.graphics = [{
      id: 'plate', type: 'rounded', startFrame: 0, durationFrames: 60,
      x: 50, y: 50, w: 320, h: 180, color: '#112233',
    }]
    f.slots[0] = {
      ...f.slots[0],
      media: 'video',
      handles: { headFrames: 0, tailFrames: 6 },
      transform: { scale: 110, x: 4, cropL: 3 },
      fx: { brightness: 5, saturation: -10 },
    }
    f.slots[1] = {
      ...f.slots[1],
      media: 'video',
      handles: { headFrames: 6, tailFrames: 0 },
      sourceInFrame: 6,
      transition: { type: 'crossfade', durationFrames: 12 },
    }
    const c = choices(2)
    c.media.shot_1 = asset('video_a', 'video', 60)
    c.media.shot_2 = asset('video_b', 'video', 60)
    const r = compileTemplatePrototype(f, design, c, carrier(2))
    expect(r.edits.videoSplits).toEqual([1000])
    expect(r.edits.transitions).toEqual([{ srcMs: 1000, type: 'crossfade', durMs: 400 }])
    expect(r.edits.sourceSegments?.[0]).toMatchObject({
      startMs: 0, endMs: 1000,
      transform: { scale: 110, x: 4, cropL: 3 },
      fx: { brightness: 5, saturation: -10 },
    })
    expect(r.edits.sourceSegments?.[1]).toMatchObject({ startMs: 1000, endMs: 2000, inMs: 200 })
    expect(r.edits.textItems?.some((item) => item.kind === 'shape' && item.shape?.type === 'rounded')).toBe(true)
    expect(r.edits.templateProvenance?.slotToItemIds).toEqual(r.slotToItemIds)
  })

  it('rejects transitions without declared A/B source handles and overlapping windows', () => {
    const missing = family(2)
    missing.slots[1] = { ...missing.slots[1], transition: { type: 'crossfade', durationFrames: 12 } }
    expect(() => validateTemplateFamily(missing)).toThrow(/requires source handles \(left 6, right 6 frames\)/)

    const overlap = family(3)
    overlap.slots[0] = { ...overlap.slots[0], handles: { headFrames: 0, tailFrames: 18 } }
    overlap.slots[1] = {
      ...overlap.slots[1],
      handles: { headFrames: 18, tailFrames: 18 },
      transition: { type: 'crossfade', durationFrames: 36 },
    }
    overlap.slots[2] = {
      ...overlap.slots[2],
      handles: { headFrames: 18, tailFrames: 0 },
      transition: { type: 'crossfade', durationFrames: 36 },
    }
    expect(() => validateTemplateFamily(overlap)).toThrow(/transition windows overlap/)
  })

  it('keeps non-authoritative provenance out of render hashes', async () => {
    const { editsVersionHash } = await import('@/lib/clips/edits-version-hash')
    const r = compileTemplatePrototype(family(1), design, choices(1), carrier(1))
    const withOtherLineage = {
      ...r.edits,
      templateProvenance: {
        ...r.edits.templateProvenance!,
        instanceId: 'instance_other',
      },
    }
    expect(editsVersionHash(r.edits)).toBe(editsVersionHash(withOtherLineage))
  })
})
