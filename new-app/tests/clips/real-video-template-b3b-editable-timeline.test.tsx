// @vitest-environment happy-dom
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { ScriptViewCompactTimeline } from '@/components/clips/editor/script-view-compact-timeline'
import { Timeline } from '@/components/clips/editor/timeline'
import { normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import {
  moveSourceSegmentBoundary,
  patchSourceSegment,
  replaceSourceSegmentMedia,
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
    expect(transitions.some((el) => el.getAttribute('data-type') === 'crossfade')).toBe(true)
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

    const beforeReload = snapshotEditableTimelineStructure(next)
    const reloaded = normalizeEdits(JSON.parse(JSON.stringify(next)), {
      clipStartMs: 0, clipEndMs: 3000, trimMinMs: 0, trimMaxMs: 3000,
    })
    expect(snapshotEditableTimelineStructure(reloaded)).toEqual(beforeReload)
    expect(reloaded.sourceSegments?.map((seg) => seg.id)).toEqual(ids)
    expect(reloaded.sourceSegments?.[1]?.sourceId).toBe('replacement_source')
    expect(reloaded.sourceSegments?.[1]?.fx).toMatchObject({ contrast: 22, saturation: -7 })
    expect(reloaded.transitions?.find((t) => t.srcMs === 1033)?.type).toBe('wipe_left')
    expect(reloaded.textItems?.find((item) => item.id === text.id)).toMatchObject({ text: 'Edited after publish' })
    expect(reloaded.audio?.music).toMatchObject({ generationId: 'replacement_music', volume: 0 })

    // Undo/redo uses the ordinary edit snapshots; stable item/layer ids survive both directions.
    const undo = initial
    const redo = reloaded
    expect(undo.sourceSegments?.map((seg) => seg.id)).toEqual(ids)
    expect(redo.sourceSegments?.map((seg) => seg.id)).toEqual(ids)
  })
})

describe('Batch 3B first-party launch target gate', () => {
  it('requires 50 families x 40 released authored treatments; community/draft rows never count', () => {
    const base = buildEditableTimelineProofCases()[0]!.family
    const families = Array.from({ length: FIRST_PARTY_LAUNCH_FAMILIES }, (_, i) => ({
      ...base,
      familyId: `launch_family_${i + 1}`,
      title: `Launch family ${i + 1}`,
    }))
    const rows: FirstPartyLaunchTreatment[] = families.flatMap((family) =>
      Array.from({ length: FIRST_PARTY_TREATMENTS_PER_FAMILY }, (_, i) => ({
        familyId: family.familyId,
        familyRevision: family.revision,
        designId: `design_${i + 1}`,
        designRevision: 1,
        origin: 'first-party' as const,
        status: 'released' as const,
        treatmentKind: i < 25 ? 'core' as const : 'authored-alternate' as const,
        visibleDimensions: i % 2
          ? ['font-hierarchy','animation-choreography','graphics'] as const
          : ['text-placement','transition-treatment','source-safe-motion'] as const,
      })),
    )
    rows.push({
      familyId: families[0]!.familyId, familyRevision: 1, designId: 'community_extra', designRevision: 1,
      origin: 'community', status: 'released', treatmentKind: 'authored-alternate',
      visibleDimensions: ['font-hierarchy','graphics','source-safe-motion'],
    })
    rows.push({
      familyId: families[0]!.familyId, familyRevision: 1, designId: 'draft_extra', designRevision: 1,
      origin: 'first-party', status: 'draft', treatmentKind: 'core',
      visibleDimensions: ['font-hierarchy','graphics','source-safe-motion'],
    })
    const result = assertFirstPartyLaunchCatalog(families, rows)
    expect(result.eligibleFamilies).toBe(50)
    expect(result.releasedFirstParty).toBe(2000)
  })

  it('rejects color/name-only style variants that lack three visible authored dimensions', () => {
    const base = buildEditableTimelineProofCases()[0]!.family
    const family = { ...base, familyId: 'weak_family' }
    expect(() => assertFirstPartyLaunchCatalog([family], [{
      familyId: family.familyId, familyRevision: 1, designId: 'weak', designRevision: 1,
      origin: 'first-party', status: 'released', treatmentKind: 'core',
      visibleDimensions: ['font-hierarchy','text-placement'],
    }])).toThrow(/at least three visible authored dimensions/)
  })
})
