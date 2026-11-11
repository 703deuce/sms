import { describe, expect, it } from 'vitest'
import {
  compileTemplate,
  type TemplateAsset,
  type TemplateChoices,
  type TemplateFamilyV1,
  type TemplateSlot,
} from '@/lib/clips/real-video-templates/sequence-contract'
import {
  BATCH7_DEPTH_CAPABILITIES,
  depthDerivedCacheKey,
} from '@/lib/clips/real-video-templates/batch7-depth'
import { addTextBackedMotionPlan } from '@/lib/clips/motion-graphics/text-adapter'
import type { MotionPlan } from '@/lib/clips/motion-graphics/contract'
import { normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'

const style = {
  headlineFont: 'Bangers' as const,
  bodyFont: 'Poppins' as const,
  textColor: '#FFFFFF',
  accentColor: '#22D3EE',
  panelColor: '#111827',
}
const slot = (n: number, frames = 60): TemplateSlot => ({
  id: 'shot_' + n, ordinal: n, role: n === 1 ? 'hero' : 'support', media: 'image',
  startFrame: (n - 1) * frames, durationFrames: frames, fit: 'cover',
  sourceAudio: 'mute', transition: 'cut',
})
const asset = (id: string, kind: 'image' | 'video' | 'audio', frames = 180): TemplateAsset => ({
  id, kind, ...(kind === 'image' ? {} : { durationFrames: frames }),
  license: { id: 'license_1', provenance: 'user-owned', reference: 'library_1' },
})
function family(count = 4, aspect: '9:16' | '1:1' | '16:9' = '9:16'): TemplateFamilyV1 {
  return {
    schemaVersion: 1, familyId: 'family_b7', revision: 1, title: 'Batch 7 primitives',
    tags: ['photo'], aspects: [aspect], fps: 30, totalFrames: count * 60,
    slots: Array.from({ length: count }, (_, i) => slot(i + 1)),
    texts: [], beatAnchors: [],
  }
}
const design = {
  schemaVersion: 1 as const, designId: 'design_b7', revision: 1, stylePackId: 'style_b7',
  familyId: 'family_b7', familyRevision: 1, musicPolicy: 'none' as const,
}
function choices(count = 4, shared = false): TemplateChoices {
  return {
    instanceId: 'instance_b7',
    media: Object.fromEntries(Array.from({ length: count }, (_, i) => [
      'shot_' + (i + 1), asset(shared ? 'same_photo' : 'photo_' + (i + 1), 'image'),
    ])),
  }
}
function carrier(frames: number, extra: Partial<ClipEditsV2> = {}) {
  return {
    durationFrames: frames,
    edits: {
      v: 2, trim: { in: 0, out: Math.round(frames * 1000 / 30) }, cutRanges: [],
      wordFixes: {}, captions: {}, layout: { mode: 'full_frame', shotOverrides: [] },
      ...extra,
    } as ClipEditsV2,
  }
}

describe('Batch 7 standalone reusable primitives', () => {
  it('compiles the required primitive set into existing editable render records', () => {
    const f = family()
    f.primitives = [
      { kind: 'photo_frame', id: 'frame', startFrame: 0, durationFrames: 60, slotId: 'shot_1',
        box: { x: .05, y: .05, width: .9, height: .9 }, thickness: 12, style },
      { kind: 'collage_card', id: 'collage', startFrame: 60, durationFrames: 60,
        slotIds: ['shot_2', 'shot_3'], title: 'Weekend', style },
      { kind: 'confetti', id: 'confetti', startFrame: 120, durationFrames: 60,
        box: { x: .05, y: .05, width: .9, height: .75 }, count: 6, style },
      { kind: 'countdown', id: 'countdown', startFrame: 0, from: 3, stepFrames: 10,
        box: { x: .30, y: .28, width: .40, height: .35 }, style },
      { kind: 'before_after', id: 'compare', startFrame: 180, durationFrames: 60,
        leftSlotId: 'shot_4', rightSlotId: 'shot_1', leftLabel: 'Before', rightLabel: 'After', style },
      { kind: 'roster_selection', id: 'roster', startFrame: 120, durationFrames: 60,
        title: 'Starting five', entries: ['Avery', 'Blake', 'Casey'], selectedIndex: 1,
        box: { x: .12, y: .18, width: .76, height: .62 }, style },
      { kind: 'calendar_label', id: 'calendar', startFrame: 180, durationFrames: 60,
        month: 'NOV', day: 11, label: 'Launch day',
        box: { x: .25, y: .18, width: .50, height: .55 }, style },
      { kind: 'route_arrow', id: 'route', startFrame: 180, durationFrames: 60, label: 'Next stop',
        box: { x: .18, y: .62, width: .64, height: .10 }, style },
      { kind: 'text_underline', id: 'underline', startFrame: 120, durationFrames: 60, text: 'Built to move',
        box: { x: .12, y: .08, width: .76, height: .18 }, style },
      { kind: 'text_glow', id: 'glow', startFrame: 180, durationFrames: 60, text: 'Night mode',
        box: { x: .15, y: .08, width: .70, height: .16 }, style },
    ]
    const result = compileTemplate(f, design, choices(), carrier(f.totalFrames))
    expect(result.edits.textItems?.some((i) => i.id.includes('frame_top'))).toBe(true)
    expect(result.edits.textItems?.some((i) => i.id.includes('confetti_'))).toBe(true)
    expect(result.edits.textItems?.filter((i) => /b7_countdown__n_/.test(i.id))).toHaveLength(3)
    expect(result.edits.textItems?.some((i) => i.id === 'b7_glow__text' && i.style.shadow?.color === '#22D3EE')).toBe(true)
    expect(result.edits.keyframes?.some((k) => k.target.startsWith('text:b7_route__arrow'))).toBe(true)
    expect(result.edits.sourceSegments?.find((s) => s.id === result.slotToItemIds.shot_2)?.layout?.kind).toBe('side_by_side')
    expect(result.edits.sourceSegments?.find((s) => s.id === result.slotToItemIds.shot_4)?.layout?.kind).toBe('side_by_side')
    expect(result.edits.textItems?.length).toBeLessThanOrEqual(60)
    expect(new Set(result.edits.textItems?.map((item) => item.id)).size).toBe(result.edits.textItems?.length)
  })

  it('preserves unrelated manual text, groups and keyframes and survives normalization without dropped text', () => {
    const manual = {
      id: 'manual_note', text: 'Keep me', startMs: 0, endMs: 2000, x: 50, y: 50,
      style: { font: 'Montserrat' as const, size: 72, color: '#FFFFFF', align: 'center' as const, case: 'none' as const },
    }
    const manual2 = {
      ...manual, id: 'manual_badge', text: 'Also keep me', y: 65,
    }
    const f = family(1)
    f.primitives = [{ kind: 'text_glow', id: 'glow', startFrame: 0, durationFrames: 60, text: 'Template',
      box: { x: .15, y: .15, width: .70, height: .20 }, style }]
    const extra = {
      textItems: [manual, manual2],
      keyframes: [{ target: 'text:manual_note', prop: 'x', points: [{ tMs: 0, v: 0 }, { tMs: 1000, v: 8 }] }],
      groups: [{ id: 'grp1', items: ['text:manual_note', 'text:manual_badge'] }],
    } as unknown as Partial<ClipEditsV2>
    const result = compileTemplate(f, design, choices(1), carrier(f.totalFrames, extra))
    expect(result.edits.textItems?.find((i) => i.id === 'manual_note')).toEqual(manual)
    expect(result.edits.keyframes?.some((k) => k.target === 'text:manual_note')).toBe(true)
    expect(result.edits.groups).toEqual(extra.groups)
    const persisted = JSON.parse(JSON.stringify(result.edits)) as ClipEditsV2
    const reloaded = normalizeEdits(persisted, { clipStartMs: 0, clipEndMs: 2000 })
    expect(reloaded.textItems).toHaveLength(result.edits.textItems?.length)
    expect(reloaded.textItems?.some((i) => i.id === 'manual_note')).toBe(true)
  })

  it('rejects a photo frame authored over the wrong slot window', () => {
    const f = family(2)
    f.primitives = [{ kind: 'photo_frame', id: 'bad_frame', startFrame: 60, durationFrames: 60, slotId: 'shot_1',
      box: { x: .05, y: .05, width: .9, height: .9 }, thickness: 12, style }]
    expect(() => compileTemplate(f, design, choices(2), carrier(f.totalFrames)))
      .toThrow(/photo_frame_window_mismatch/)
  })

  it('fails closed at textItems capacity instead of dropping manual items', () => {
    const f = family(1)
    f.primitives = [{ kind: 'photo_frame', id: 'frame', startFrame: 0, durationFrames: 60, slotId: 'shot_1',
      box: { x: .05, y: .05, width: .9, height: .9 }, thickness: 12, style }]
    const manual = Array.from({ length: 58 }, (_, i) => ({
      id: 'manual_' + i, text: 'M' + i, startMs: 0, endMs: 2000, x: 50, y: 50,
      style: { font: 'Montserrat' as const, size: 48, color: '#FFFFFF', align: 'center' as const, case: 'none' as const },
    }))
    expect(() => compileTemplate(f, design, choices(1), carrier(f.totalFrames, { textItems: manual })))
      .toThrow(/text_capacity/)
  })

  it.each(['9:16', '1:1', '16:9'] as const)('fits authored text deterministically in %s', (aspect) => {
    const f = family(1, aspect)
    f.primitives = [{ kind: 'text_underline', id: 'headline', startFrame: 0, durationFrames: 60,
      text: 'A professionally fitted title across the frame',
      box: { x: .08, y: .10, width: .84, height: .24 }, style }]
    const result = compileTemplate(f, design, { ...choices(1), aspect }, carrier(f.totalFrames))
    const item = result.edits.textItems?.find((i) => i.id === 'b7_headline__text')
    expect(item?.text).toBeTruthy()
    expect(item?.style.size).toBeGreaterThanOrEqual(24)
    expect(item?.style.size).toBeLessThanOrEqual(240)
  })

  it('compiles a four-photo collage to the existing 2x2 source grid without flattening photos', () => {
    const f = family(4)
    f.primitives = [{ kind: 'collage_card', id: 'four_up', startFrame: 0, durationFrames: 60,
      slotIds: ['shot_1', 'shot_2', 'shot_3', 'shot_4'], title: 'Four moments', style }]
    const result = compileTemplate(f, design, choices(4), carrier(f.totalFrames))
    const seg = result.edits.sourceSegments?.find((s) => s.id === result.slotToItemIds.shot_1)
    expect(seg?.layout).toMatchObject({ kind: 'grid' })
    expect(new Set([
      seg?.sourceId, seg?.layout?.withSourceId, seg?.layout?.withSourceId2, seg?.layout?.withSourceId3,
    ]).size).toBe(4)
  })

  it('keeps the same source usable in independent slots and preserves authored crop transforms', () => {
    const f = family(2)
    f.slots[0] = { ...f.slots[0], transform: { cropL: 5, cropR: 3, scale: 108 } }
    f.primitives = [{ kind: 'photo_frame', id: 'frame', startFrame: 0, durationFrames: 60, slotId: 'shot_1',
      box: { x: .05, y: .05, width: .9, height: .9 }, thickness: 12, style }]
    const result = compileTemplate(f, design, choices(2, true), carrier(f.totalFrames))
    expect(result.edits.sources).toHaveLength(1)
    expect(result.edits.sourceSegments).toHaveLength(2)
    expect(result.edits.sourceSegments?.[0]?.id).not.toBe(result.edits.sourceSegments?.[1]?.id)
    expect(result.edits.sourceSegments?.[0]?.transform).toEqual({ cropL: 5, cropR: 3, scale: 108 })
    expect(result.edits.sourceSegments?.[0]?.sourceId).toBe(result.edits.sourceSegments?.[1]?.sourceId)
  })

  it('keeps authored crop and primitive structure when a photo slot is replaced', () => {
    const f = family(2)
    f.slots[0] = { ...f.slots[0], transform: { cropL: 7, cropT: 4, cropR: 2, cropB: 3, scale: 112 } }
    f.primitives = [{ kind: 'photo_frame', id: 'frame', startFrame: 0, durationFrames: 60, slotId: 'shot_1',
      box: { x: .05, y: .05, width: .9, height: .9 }, thickness: 12, style }]
    const before = compileTemplate(f, design, {
      ...choices(2),
      media: { shot_1: asset('photo_before', 'image'), shot_2: asset('photo_2', 'image') },
    }, carrier(f.totalFrames))
    const after = compileTemplate(f, design, {
      ...choices(2),
      media: { shot_1: asset('photo_after', 'image'), shot_2: asset('photo_2', 'image') },
    }, carrier(f.totalFrames))
    const beforeSeg = before.edits.sourceSegments?.find((seg) => seg.id === before.slotToItemIds.shot_1)
    const afterSeg = after.edits.sourceSegments?.find((seg) => seg.id === after.slotToItemIds.shot_1)
    expect(after.slotToItemIds.shot_1).toBe(before.slotToItemIds.shot_1)
    expect(afterSeg?.sourceId).not.toBe(beforeSeg?.sourceId)
    expect(afterSeg?.transform).toEqual(beforeSeg?.transform)
    expect(afterSeg?.transform).toEqual({ cropL: 7, cropT: 4, cropR: 2, cropB: 3, scale: 112 })
    expect(after.edits.textItems?.map((item) => item.id)).toEqual(before.edits.textItems?.map((item) => item.id))
  })

  it('keeps a dense complex graphic composition under the 60-item capacity without dropping layers', () => {
    const f = family(1)
    f.primitives = [
      { kind: 'confetti', id: 'confetti', startFrame: 0, durationFrames: 60,
        box: { x: .04, y: .04, width: .92, height: .72 }, count: 12, style },
      { kind: 'roster_selection', id: 'roster', startFrame: 0, durationFrames: 60,
        title: 'Starting five', entries: ['Avery', 'Blake', 'Casey', 'Drew', 'Emery'], selectedIndex: 2,
        box: { x: .12, y: .18, width: .76, height: .62 }, style },
      { kind: 'calendar_label', id: 'calendar', startFrame: 0, durationFrames: 60,
        month: 'NOV', day: 11, label: 'Launch day',
        box: { x: .62, y: .05, width: .30, height: .28 }, style },
      { kind: 'route_arrow', id: 'route', startFrame: 0, durationFrames: 60, label: 'Next stop',
        box: { x: .18, y: .78, width: .64, height: .08 }, style },
      { kind: 'text_underline', id: 'underline', startFrame: 0, durationFrames: 60, text: 'Built to move',
        box: { x: .12, y: .05, width: .42, height: .16 }, style },
      { kind: 'text_glow', id: 'glow', startFrame: 0, durationFrames: 60, text: 'Night mode',
        box: { x: .15, y: .88, width: .70, height: .10 }, style },
    ]
    const result = compileTemplate(f, design, choices(1), carrier(f.totalFrames))
    const generated = result.edits.textItems ?? []
    expect(generated.length).toBeGreaterThan(25)
    expect(generated.length).toBeLessThanOrEqual(60)
    expect(new Set(generated.map((item) => item.id)).size).toBe(generated.length)
    expect(generated.some((item) => item.id === 'b7_roster__entry_4')).toBe(true)
    expect(generated.filter((item) => item.id.startsWith('b7_confetti__confetti_'))).toHaveLength(12)
  })

  it('reduces slot motion and flashing transitions at the shared compiler boundary', () => {
    const f = family(2)
    f.slots[0] = {
      ...f.slots[0],
      handles: { headFrames: 0, tailFrames: 5 },
      motion: { to: { scale: 108 }, ease: 'inOut' },
    }
    f.slots[1] = {
      ...f.slots[1],
      handles: { headFrames: 5, tailFrames: 0 },
      transition: { type: 'dip_white', durationFrames: 10 },
      motion: { from: { x: -4 }, to: { x: 4 }, ease: 'inOut' },
    }
    const reducedMotionResult = compileTemplate(
      f, design, { ...choices(2), accessibility: { reducedMotion: true } }, carrier(f.totalFrames),
    )
    expect(reducedMotionResult.edits.transitions).toBeUndefined()
    expect(reducedMotionResult.edits.keyframes?.some((k) => k.target === 'video')).toBe(false)
    expect(reducedMotionResult.sequence.items[1]?.transition).toBe('cut')
    expect(reducedMotionResult.sequence.items.some((item) => item.motion)).toBe(false)

    const reducedFlashResult = compileTemplate(
      f, design, { ...choices(2), accessibility: { reducedFlash: true } }, carrier(f.totalFrames),
    )
    expect(reducedFlashResult.edits.transitions?.[0]?.type).toBe('crossfade')
    expect(reducedFlashResult.sequence.items[1]?.transition).toMatchObject({ type: 'crossfade' })
  })

  it('provides reduced-motion / reduced-flash alternatives without changing static structure', () => {
    const f = family(1)
    f.primitives = [
      { kind: 'confetti', id: 'confetti', startFrame: 0, durationFrames: 60,
        box: { x: .05, y: .05, width: .9, height: .8 }, count: 5, style },
      { kind: 'route_arrow', id: 'route', startFrame: 0, durationFrames: 60,
        box: { x: .2, y: .7, width: .6, height: .1 }, style },
    ]
    const result = compileTemplate(f, design,
      { ...choices(1), accessibility: { reducedMotion: true, reducedFlash: true } },
      carrier(f.totalFrames))
    expect(result.edits.textItems?.some((i) => i.id.includes('confetti'))).toBe(true)
    expect(result.edits.keyframes?.some((k) => k.target.startsWith('text:b7_'))).toBe(false)
  })
})

describe('Batch 7 count-up gating and existing font propagation', () => {
  it('rejects count_up rather than pretending pop is numeric progression', () => {
    const plan: MotionPlan = {
      version: 1, mode: 'streamer_continuous', styleProfileId: null, fps: 30, durationMs: 3000, format: '9:16',
      graphics: [{
        id: 'counter', templateId: 'stat_counter', startMs: 0, endMs: 3000, text: '42',
        box: { x: .2, y: .2, width: .6, height: .2 }, zIndex: 1,
        style: { fontFamily: 'Bangers', textColor: '#FFFFFF', accentColor: '#22D3EE' },
        intro: { kind: 'count_up', durationMs: 500, easing: 'out' },
        outro: { kind: 'fade', durationMs: 200, easing: 'in' },
        keyframes: [], assetIds: [], rationale: 'explicit counter',
      }],
    }
    const result = addTextBackedMotionPlan(carrier(90).edits, plan)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('unsupported_animation')
  })
})

describe('Batch 7 F05 depth honesty and fallback gating', () => {
  it('keeps ordinary-photo true depth hidden and records the exact existing RVM revision/license', () => {
    expect(BATCH7_DEPTH_CAPABILITIES.ordinaryPhotoTrueDepth.defaultEligible).toBe(false)
    expect(BATCH7_DEPTH_CAPABILITIES.ordinaryPhotoTrueDepth.status).toBe('unsupported_hidden')
    expect(BATCH7_DEPTH_CAPABILITIES.existingVideoMatte.revision)
      .toBe('53d74c6826735f01f4406b5ca9075eee27bec094')
    expect(BATCH7_DEPTH_CAPABILITIES.existingVideoMatte.license).toContain('GPL-3.0')
  })

  it('keys derivation by workspace, source, revision and crop only', () => {
    const base = { workspaceId: 'ws1', sourceAssetId: 'photo1', model: 'depth_model', revision: 'r1',
      crop: { x: 0, y: 0, width: 1, height: 1 } }
    expect(depthDerivedCacheKey(base)).toBe(depthDerivedCacheKey(base))
    expect(depthDerivedCacheKey({ ...base, crop: { x: .1, y: 0, width: .9, height: 1 } }))
      .not.toBe(depthDerivedCacheKey(base))
    expect(depthDerivedCacheKey({ ...base, sourceAssetId: 'photo2' })).not.toBe(depthDerivedCacheKey(base))
  })

  it('keeps four-photo F05 unavailable while producing independent future cache identities', () => {
    expect(BATCH7_DEPTH_CAPABILITIES.suppliedAlphaForeground.status).toBe('unsupported_current_renderer')
    expect(BATCH7_DEPTH_CAPABILITIES.suppliedLayeredParallax.defaultEligible).toBe(false)
    expect(BATCH7_DEPTH_CAPABILITIES.ordinaryPhotoTrueDepth.fallbackChoices)
      .toEqual(['photo_frame', 'collage_card', 'before_after'])
    const keys = new Set(
      Array.from({ length: 4 }, (_, i) => depthDerivedCacheKey({
        workspaceId: 'ws1',
        sourceAssetId: 'photo' + i,
        model: 'future_depth_model',
        revision: 'r1',
        crop: { x: 0, y: 0, width: 1, height: 1 },
      })),
    )
    expect(keys.size).toBe(4)
  })
})
