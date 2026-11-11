// @vitest-environment happy-dom
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { ScriptViewCompactTimeline } from '@/components/clips/editor/script-view-compact-timeline'
import { Timeline } from '@/components/clips/editor/timeline'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { compileTemplate, type TemplateDesignV1 } from '@/lib/clips/real-video-templates/sequence-contract'
import {
  moveSourceSegmentBoundary,
  patchSourceSegment,
  replaceSourceSegmentMedia,
  segmentMediaMs,
  type ClipMediaSource,
} from '@/lib/clips/editor/sources'
import { setCutTransition } from '@/lib/clips/editor/transitions'
import { setPropertyAt, sourceSegmentTarget } from '@/lib/clips/editor/keyframes'
import { patchAudioClip } from '@/lib/clips/editor/audio-clip'
import {
  editableTimelineProofJson,
  buildEditableTimelineProofCases,
} from '@/lib/clips/real-video-templates/editable-timeline-proof-cases'
import {
  proveEditableTimelineStructure,
  snapshotEditableTimelineStructure,
} from '@/lib/clips/real-video-templates/editable-timeline-proof'
import {
  assertFirstPartyLaunchCatalog,
  FIRST_PARTY_LAUNCH_FAMILIES,
  FIRST_PARTY_TREATMENTS_PER_FAMILY,
  type FirstPartyLaunchTreatment,
} from '@/lib/clips/real-video-templates/launch-catalog'

beforeAll(() => {
  class RO { observe() {}; unobserve() {}; disconnect() {} }
  vi.stubGlobal('ResizeObserver', RO)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

const words: never[] = []
const dataImage = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='

function sourceUrls(edits: ClipEditsV2) {
  return Object.fromEntries((edits.sources ?? []).map((s) => [s.refId, dataImage]))
}

describe('Batch 3B machine-readable editable timeline proof', () => {
  it('matches expected vs actual IDs and times for one-photo, mixed and 30-slot birthday', () => {
    const cases = buildEditableTimelineProofCases()
    expect(cases.map((c) => c.id)).toEqual(['one-photo', 'mixed-sources', 'birthday-30'])
    for (const c of cases) {
      expect(c.proof.matches, `${c.id}: ${c.proof.errors.join('; ')}`).toBe(true)
      expect(c.proof.actual.mediaItems).toHaveLength(c.family.slots.length)
      expect(c.proof.actual.cuts).toHaveLength(Math.max(0, c.family.slots.length - 1))
      expect(c.proof.actual.inserts).toEqual([])
    }
    expect(cases[2]!.proof.actual.mediaItems).toHaveLength(30)
    expect(cases[2]!.proof.actual.cuts).toHaveLength(29)
    expect(cases[2]!.proof.actual.music?.endMs).toBe(30_000)

    const json = JSON.parse(editableTimelineProofJson())
    expect(json.schema).toBe('transovo.real-video-template.editable-timeline-proof.v1')
    expect(json.cases).toHaveLength(3)
    expect(json.cases.every((c: { matches: boolean }) => c.matches)).toBe(true)
  })

  it('fails closed when an authoritative transition object is lost', () => {
    const c = buildEditableTimelineProofCases()[1]!
    const broken = { ...c.compiled.edits, transitions: undefined }
    const proof = proveEditableTimelineStructure(c.family, c.design, c.choices, c.compiled, broken)
    expect(proof.matches).toBe(false)
    expect(proof.errors.some((e) => e.includes('transition mismatch'))).toBe(true)
  })
})

describe('Batch 3B existing editor surfaces expose real authoritative objects', () => {
  it('Compact shows slot clips, cuts, transition, text/graphic, music and item-local keys without geometry changes', () => {
    const c = buildEditableTimelineProofCases()[1]!
    const onSlot = vi.fn(), onText = vi.fn(), onMusic = vi.fn(), onTransition = vi.fn()
    const ui = render(
      <ScriptViewCompactTimeline
        peaks={{ peaks: [], peaksPerSec: 0, durationMs: 3000 }}
        edits={c.compiled.edits}
        words={words}
        trimInMs={0}
        trimOutMs={3000}
        mediaOffsetMs={0}
        outputDurationMs={3000}
        outputMs={1000}
        videoUrl={null}
        sourceUrls={sourceUrls(c.compiled.edits)}
        onSelectSourceSegment={onSlot}
        onSelectTextItem={onText}
        onSelectMusic={onMusic}
        onOpenTransition={onTransition}
        onSeekOutput={vi.fn()}
      />,
    )
    expect(ui.getAllByTestId('script-compact-source-segment')).toHaveLength(3)
    expect(ui.getAllByTestId('script-compact-slot-cut')).toHaveLength(2)
    expect(ui.getAllByTestId('script-compact-transition')).toHaveLength(1)
    expect(ui.getAllByTestId('script-compact-text-item')).toHaveLength(1)
    expect(ui.getAllByTestId('script-compact-graphic-item')).toHaveLength(1)
    expect(ui.getAllByTestId('script-compact-music-item')).toHaveLength(1)
    expect(ui.getAllByTestId('script-compact-source-keyframe').length).toBeGreaterThan(0)
    expect(ui.getAllByTestId('script-compact-layer-keyframe').length).toBeGreaterThan(0)
    expect(ui.container.querySelector('.h-\\[calc\\(44px\\+18px\\+36px\\+8px\\)\\]')).not.toBeNull()

    fireEvent.click(ui.getAllByTestId('script-compact-source-segment')[1]!)
    fireEvent.click(ui.getByTestId('script-compact-text-item'))
    fireEvent.click(ui.getByTestId('script-compact-music-item'))
    fireEvent.click(ui.getByTestId('script-compact-transition'))
    expect(onSlot).toHaveBeenCalledWith(c.compiled.edits.sourceSegments?.[1]?.id)
    expect(onText).toHaveBeenCalled()
    expect(onMusic).toHaveBeenCalled()
    expect(onTransition).toHaveBeenCalledWith(1000)
  })

  it('full Timeline renders the same real slot items, transitions, text/graphic, music and slot keys', () => {
    const c = buildEditableTimelineProofCases()[1]!
    const e = c.compiled.edits
    const ui = render(
      <Timeline
        edits={e}
        words={[]}
        shots={[]}
        outputMs={1000}
        clipOutputDurationMs={3000}
        onSeekOutput={vi.fn()}
        clipStartMs={0}
        clipEndMs={3000}
        trimMinMs={0}
        trimMaxMs={3000}
        onCommitEdits={vi.fn()}
        onSelectSourceSegment={vi.fn()}
        sourceUrls={sourceUrls(e)}
      />,
    )
    expect(ui.getAllByTestId('timeline-source-segment')).toHaveLength(3)
    expect(ui.getAllByTestId('timeline-source-segment').map((el) => el.getAttribute('data-item-id')))
      .toEqual(e.sourceSegments?.map((seg) => seg.id))
    expect(ui.getAllByTestId('timeline-source-keyframe').length).toBeGreaterThan(0)
    const transitions = ui.getAllByTestId('timeline-transition-handle')
    expect(transitions).toHaveLength(2)
    expect(transitions.some((el) => el.getAttribute('data-type') === 'crossfade')).toBe(true)
    expect(transitions.some((el) => el.getAttribute('data-type') == null)).toBe(true)
    expect(ui.getAllByTestId('timeline-item-text').length).toBeGreaterThanOrEqual(2)
    expect(ui.getAllByTestId('timeline-item-music')).toHaveLength(1)
  })
})

describe('Batch 3B edits survive flush/reload with stable item-local identity', () => {
  it('replaces a slot, rolls a cut, changes transition/text/animation/music/effect, then reloads losslessly', () => {
    const c = buildEditableTimelineProofCases()[1]!
    const initial = c.compiled.edits
    const ids = initial.sourceSegments!.map((seg) => seg.id)
    const second = ids[1]!
    const replacement: ClipMediaSource = {
      id: 'replacement_source', ref: 'upload', refId: 'replacement_video', mediaType: 'video', durationMs: 10_000,
    }

    let next = replaceSourceSegmentMedia(initial, second, replacement)
    expect(next.sourceSegments?.[1]?.id).toBe(second)
    expect(next.sourceSegments?.[1]?.sourceId).toBe('replacement_source')
    expect(next.keyframes?.some((k) => k.target === sourceSegmentTarget(second))).toBe(true)

    next = moveSourceSegmentBoundary(next, ids[0]!, ids[1]!, 1033)
    expect(next.sourceSegments?.[0]?.endMs).toBe(1033)
    expect(next.sourceSegments?.[1]?.startMs).toBe(1033)
    expect(next.videoSplits).toContain(1033)
    expect(next.transitions?.[0]?.srcMs).toBe(1033)

    next = setCutTransition(next, 1033, { type: 'wipe_left', durMs: 300 })
    expect(next.transitions?.find((t) => t.srcMs === 1033)?.type).toBe('wipe_left')

    const text = next.textItems!.find((item) => item.kind !== 'shape')!
    next = {
      ...next,
      textItems: next.textItems!.map((item) => item.id === text.id
        ? { ...item, text: 'Edited after publish', anim: { in: { type: 'pop', unit: 'block', durMs: 200 } } }
        : item),
    }
    next = setPropertyAt(next, `text:${text.id}`, 'x', 0, 7)

    const musicId = next.audio!.music!.generationId
    next = patchAudioClip(next, 'music', musicId, { volume: 0 })!
    next = {
      ...next,
      audio: { ...next.audio!, music: { ...next.audio!.music!, generationId: 'replacement_music', uploadId: 'replacement_music', volume: 0 } },
    }

    next = {
      ...next,
      sourceSegments: patchSourceSegment(next.sourceSegments, second, { fx: { contrast: 22, saturation: -7 } }, next.sources),
    }

    next = {
      ...next,
      captions: { ...next.captions, enabled: true },
      captionLines: [{ id: 'caption_all', startMs: 0, endMs: 3000, text: 'CAPTION THROUGH EVERY SLOT' }],
    }

    const beforeReload = snapshotEditableTimelineStructure(next)
    const reloaded = normalizeEdits(JSON.parse(JSON.stringify(next)), {
      clipStartMs: 0, clipEndMs: 3000, trimMinMs: 0, trimMaxMs: 3000,
    })
    expect(snapshotEditableTimelineStructure(reloaded)).toEqual(beforeReload)
    expect(reloaded.sourceSegments?.map((seg) => seg.id)).toEqual(ids)
    expect(reloaded.sourceSegments?.[1]?.sourceId).toBe('replacement_source')
    expect(reloaded.sourceSegments?.[1]).toMatchObject({
      id: second,
      startMs: 1033,
      inMs: 450,
      speed: 1.5,
      transform: { x: 4, scale: 105 },
      fx: { contrast: 22, saturation: -7 },
    })
    const mappedSource = reloaded.sources?.find((row) => row.id === 'replacement_source')
    expect(mappedSource).toBeTruthy()
    expect(segmentMediaMs(reloaded.sourceSegments![1]!, mappedSource, 1100)).toBe(551)
    expect(reloaded.transitions?.find((t) => t.srcMs === 1033)?.type).toBe('wipe_left')
    expect(reloaded.textItems?.find((item) => item.id === text.id)).toMatchObject({ text: 'Edited after publish' })
    expect(reloaded.audio?.music).toMatchObject({ generationId: 'replacement_music', volume: 0 })
    expect(reloaded.captionLines).toEqual([{ id: 'caption_all', startMs: 0, endMs: 3000, text: 'CAPTION THROUGH EVERY SLOT' }])

    // Undo/redo uses the ordinary edit snapshots; stable item/layer ids survive both directions.
    const undo = initial
    const redo = reloaded
    expect(undo.sourceSegments?.map((seg) => seg.id)).toEqual(ids)
    expect(redo.sourceSegments?.map((seg) => seg.id)).toEqual(ids)
    expect(redo.keyframes?.filter((k) => k.target === sourceSegmentTarget(second)).map((k) => k.prop).sort())
      .toEqual(['scale', 'x'])
    expect(redo.textItems?.map((item) => item.id).sort()).toEqual(undo.textItems?.map((item) => item.id).sort())
  })
})

describe('Batch 3B professional timing gate', () => {
  it('rejects off-beat and under-specified semantic first-party timing', async () => {
    const { validateTemplateEditorialTiming } = await import('@/lib/clips/real-video-templates/sequence-contract')
    const beat = structuredClone(buildEditableTimelineProofCases()[1]!.family)
    beat.slots[1] = { ...beat.slots[1]!, startFrame: 31 }
    expect(() => validateTemplateEditorialTiming(beat)).toThrow(/not on an authored beat\/phrase accent/)

    const semantic = structuredClone(buildEditableTimelineProofCases()[0]!.family)
    semantic.timingMode = 'semantic'
    semantic.phraseAnchors = []
    expect(() => validateTemplateEditorialTiming(semantic)).toThrow(/requires phrase anchors/)
  })
})

describe('Batch 3B compiler-applied design treatments', () => {
  it('changes real editable text, graphic, transition and source-motion objects and still proves structure', () => {
    const c = buildEditableTimelineProofCases()[1]!
    const design: TemplateDesignV1 = {
      ...c.design,
      designId: 'treated_mixed',
      stylePackId: 'treated_pack',
      treatment: {
        texts: [{
          id: 'headline', font: 'Anton', size: 70, x: 42,
          animation: { in: { type: 'pop', unit: 'block', durationFrames: 6 } },
        }],
        graphics: [{
          id: 'accent', type: 'star', x: 82,
          animation: { in: { type: 'fade', unit: 'block', durationFrames: 6 } },
        }],
        slots: [{
          id: 'video',
          transition: { type: 'wipe_left', durationFrames: 12 },
          motion: { from: { x: -6, scale: 96 }, to: { x: 5, scale: 109 }, ease: 'inOut' },
        }],
      },
    }
    const base = defaultEdits({ clipStartMs: 0, clipEndMs: 3000 })
    const compiled = compileTemplate(c.family, design, c.choices, {
      durationFrames: 90,
      edits: { ...base, trim: { in: 0, out: 3000 }, layout: { ...base.layout, mode: 'full_frame' } },
    })
    const text = compiled.edits.textItems?.find((item) => item.kind !== 'shape')
    const graphic = compiled.edits.textItems?.find((item) => item.kind === 'shape')
    expect(text).toMatchObject({ x: 42, style: { font: 'Anton', size: 70 }, anim: { in: { type: 'pop' } } })
    expect(graphic).toMatchObject({ x: 82, shape: { type: 'star' }, anim: { in: { type: 'fade' } } })
    expect(compiled.edits.transitions).toEqual([{ srcMs: 1000, type: 'wipe_left', durMs: 400 }])
    const slotId = compiled.slotToItemIds.video
    expect(compiled.edits.keyframes?.filter((k) => k.target === `source:${slotId}`).map((k) => k.prop).sort())
      .toEqual(['scale', 'x'])
    expect(proveEditableTimelineStructure(c.family, design, c.choices, compiled).matches).toBe(true)
  })
})

describe('Batch 3B first-party launch target gate', () => {
  const designFor = (familyId: string, i: number): TemplateDesignV1 => ({
    schemaVersion: 1,
    designId: `design_${i + 1}`,
    revision: 1,
    stylePackId: i < 25 ? `core_pack_${i + 1}` : `core_pack_${((i - 25) % 25) + 1}`,
    familyId,
    familyRevision: 1,
    musicPolicy: 'licensed-only',
    treatment: {
      texts: [{
        id: 'title',
        font: i % 3 === 0 ? 'Anton' : i % 3 === 1 ? 'Poppins' : 'Montserrat',
        size: 48 + i,
        x: 20 + i,
        animation: { in: { type: i % 2 ? 'fade' : 'pop', unit: 'block', durationFrames: 3 } },
      }],
      graphics: [{
        id: 'bar',
        x: 18 + i,
        w: 420 + i * 4,
      }],
    },
  })

  it('requires 50 families x 40 real released treatments; community/draft rows never count', () => {
    const base = buildEditableTimelineProofCases()[0]!.family
    const families = Array.from({ length: FIRST_PARTY_LAUNCH_FAMILIES }, (_, i) => ({
      ...base,
      familyId: `launch_family_${i + 1}`,
      title: `Launch family ${i + 1}`,
    }))
    const rows: FirstPartyLaunchTreatment[] = families.flatMap((family) =>
      Array.from({ length: FIRST_PARTY_TREATMENTS_PER_FAMILY }, (_, i) => ({
        design: designFor(family.familyId, i),
        origin: 'first-party' as const,
        status: 'released' as const,
        treatmentKind: i < 25 ? 'core' as const : 'authored-alternate' as const,
      })),
    )
    rows.push({
      design: { ...designFor(families[0]!.familyId, 0), designId: 'community_extra' },
      origin: 'community', status: 'released', treatmentKind: 'authored-alternate',
    })
    rows.push({
      design: { ...designFor(families[0]!.familyId, 1), designId: 'draft_extra' },
      origin: 'first-party', status: 'draft', treatmentKind: 'core',
    })
    const result = assertFirstPartyLaunchCatalog(families, rows)
    expect(result.eligibleFamilies).toBe(50)
    expect(result.releasedFirstParty).toBe(2000)
    expect(Object.values(result.familyCounts).every((c) =>
      c.released === 40 && c.core === 25 && c.authoredAlternates === 15 && c.coreStylePacks === 25,
    )).toBe(true)
  })

  it('rejects color/name/style-pack-only variants that lack three real authored dimensions', () => {
    const base = buildEditableTimelineProofCases()[0]!.family
    const family = { ...base, familyId: 'weak_family' }
    const weak: TemplateDesignV1 = {
      schemaVersion: 1, designId: 'weak', revision: 1, stylePackId: 'renamed_pack',
      familyId: family.familyId, familyRevision: 1, musicPolicy: 'licensed-only',
      treatment: { texts: [{ id: 'title', color: '#00FF00' }] },
    }
    expect(() => assertFirstPartyLaunchCatalog([family], [{
      design: weak, origin: 'first-party', status: 'released', treatmentKind: 'core',
    }])).toThrow(/at least three visible authored dimensions/)
  })

  it('rejects duplicate treatment recipes even when design IDs and style-pack names differ', () => {
    const base = buildEditableTimelineProofCases()[0]!.family
    const family = { ...base, familyId: 'duplicate_family' }
    const a = designFor(family.familyId, 0)
    const b = { ...structuredClone(a), designId: 'renamed_duplicate', stylePackId: 'another_pack' }
    expect(() => assertFirstPartyLaunchCatalog([family], [
      { design: a, origin: 'first-party', status: 'released', treatmentKind: 'core' },
      { design: b, origin: 'first-party', status: 'released', treatmentKind: 'core' },
    ])).toThrow(/duplicate treatment recipe/)
  })
})
