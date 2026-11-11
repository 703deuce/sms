// @vitest-environment happy-dom
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { ScriptViewCompactTimeline } from '@/components/clips/editor/script-view-compact-timeline'
import { compileTemplate, type TemplateAsset } from '@/lib/clips/real-video-templates/sequence-contract'
import { defaultEdits } from '@/lib/clips/edits'
import { sourceSegmentWindows } from '@/lib/clips/editor/sources'
import { timebaseFor, videoLaneSegments } from '@/lib/clips/editor/clip-timeline'

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', RO)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 1
  })
})

const photo = (id: string): TemplateAsset => ({
  id,
  kind: 'image',
  license: { id: 'license_' + id, provenance: 'user-owned', reference: 'library_' + id },
})

function compiledEdits() {
  const family = {
    schemaVersion: 1,
    familyId: 'two_slots',
    revision: 1,
    title: 'Two slots',
    tags: ['test'],
    aspects: ['9:16'],
    fps: 30,
    totalFrames: 60,
    slots: [
      { id: 'one', ordinal: 1, role: 'hero', media: 'image', startFrame: 0, durationFrames: 30, fit: 'cover', sourceAudio: 'mute', transition: 'cut' },
      { id: 'two', ordinal: 2, role: 'support', media: 'image', startFrame: 30, durationFrames: 30, fit: 'contain', sourceAudio: 'mute', transition: 'cut' },
    ],
    texts: [],
    beatAnchors: [],
  }
  const design = {
    schemaVersion: 1, designId: 'clean', revision: 1, stylePackId: 'clean_a',
    familyId: 'two_slots', familyRevision: 1, musicPolicy: 'none',
  }
  const base = defaultEdits({ clipStartMs: 0, clipEndMs: 2000 })
  return compileTemplate(
    family,
    design,
    { instanceId: 'instance_a', media: { one: photo('photo_a'), two: photo('photo_b') } },
    { durationFrames: 60, edits: { ...base, trim: { in: 0, out: 2000 }, layout: { ...base.layout, mode: 'full_frame' } } },
  ).edits
}

describe('B3 editor slot clips', () => {
  it('shows every slot as a selectable Compact Video-lane clip without changing Compact geometry', () => {
    const edits = compiledEdits()
    const onSelect = vi.fn()
    const ui = render(
      <ScriptViewCompactTimeline
        peaks={{ peaks: [], peaksPerSec: 0, durationMs: 2000 }}
        edits={edits}
        words={[]}
        trimInMs={0}
        trimOutMs={2000}
        mediaOffsetMs={0}
        outputDurationMs={2000}
        outputMs={0}
        videoUrl={null}
        sourceUrls={{ photo_a: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', photo_b: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }}
        onSelectSourceSegment={onSelect}
        onSeekOutput={vi.fn()}
      />,
    )
    const slots = ui.getAllByTestId('script-compact-source-segment')
    expect(slots).toHaveLength(2)
    expect(slots[0]).toHaveStyle({ height: '44px' })
    const fixedLane = ui.container.querySelector('.h-\\[calc\\(44px\\+18px\\+36px\\+8px\\)\\]')
    expect(fixedLane).not.toBeNull()
    fireEvent.click(slots[1]!)
    expect(onSelect).toHaveBeenCalledWith(edits.sourceSegments?.[1]?.id)
  })

  it('uses the same two source slots and split boundary on the full Timeline timebase', () => {
    const edits = compiledEdits()
    const tb = timebaseFor(edits)
    expect(sourceSegmentWindows(tb, edits.sourceSegments).map((w) => [w.startMs, w.endMs]))
      .toEqual([[0, 1000], [1000, 2000]])
    expect(videoLaneSegments(tb, edits.videoSplits).map((s) => [s.a, s.b]))
      .toEqual([[0, 1000], [1000, 2000]])
  })
})
