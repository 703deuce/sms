// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { Timeline } from '@/components/clips/editor/timeline'
import { KeyframeInspector } from '@/components/clips/editor/timeline/keyframe-inspector'
import {
  defaultEdits,
  editsPayloadForSave,
  mergeEditsPatch,
  normalizeEdits,
  orderedKeepSegments,
  type ClipEditsV2,
} from '@/lib/clips/edits'
import {
  moveVideoSegment,
  moveVideoSegmentWithGap,
  shiftVideoSegmentWithinSlot,
} from '@/lib/clips/editor/timeline-edit-ops'
import { fitPxPerSec, trackWidthPx, zoomPercent, TIMELINE_DEFAULT_PX_PER_SEC } from '@/lib/clips/editor/timeline-zoom'
import { IDENTITY_TIME_MAP, speedBaseMs, speedDisplayMs } from '@/lib/clips/editor/export-time'
import { findTrack, layerTransformAt, setPropertyAt, toggleKeyframeAt } from '@/lib/clips/editor/keyframes'
import { setVideoLook } from '@/lib/clips/editor/color'
import { pixelateBlock } from '@/lib/clips/editor/fx-library'
import { captionDragDelta } from '@/lib/clips/editor/caption-drag-rect'
import { editorLayoutToWorker } from '@/lib/clips/layout-mode-map'
import { exportPixelSize } from '@/lib/clips/export-aspect'
import { loopSeekAtOutput } from '@/lib/clips/editor/loop-playback'
import { replaceBrollMedia, type ProjectMediaItem } from '@/lib/clips/editor/media-add'

const bounds = { clipStartMs: 0, clipEndMs: 10_000, trimMinMs: 0, trimMaxMs: 12_000 }
const base = (patch: Partial<ClipEditsV2> = {}): ClipEditsV2 => ({
  ...normalizeEdits(defaultEdits(bounds), bounds),
  ...patch,
})
const ctx = (edits: ClipEditsV2) => ({ edits, previewEdits: edits })

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

describe('PR5 historical editor finish regression gate', () => {
  it('AR01/AR02 selecting a main clip does not jump the preview or seek', () => {
    const onSeekOutput = vi.fn()
    const ui = render(
      <Timeline
        edits={base()}
        words={[]}
        shots={[]}
        outputMs={4000}
        clipOutputDurationMs={10_000}
        onSeekOutput={onSeekOutput}
        clipStartMs={0}
        clipEndMs={10_000}
        trimMinMs={0}
        trimMaxMs={12_000}
        onCommitEdits={vi.fn()}
      />,
    )
    const clip = ui.getByTestId('timeline-item-video')
    fireEvent.pointerDown(clip, { button: 0, clientX: 50, pointerId: 1 })
    fireEvent.pointerUp(window, { clientX: 50, pointerId: 1 })
    expect(clip.getAttribute('data-selected')).toBe('true')
    expect(onSeekOutput).not.toHaveBeenCalled()
  })

  it('AR03/AR04 trim/reorder source mapping stays bounded and magnet-off preserves a real gap', () => {
    const edits = base({ videoSplits: [4000] })
    const moved = moveVideoSegment(ctx(edits), 'seg:4000', 'seg:0')
    expect(moved).not.toBeNull()
    expect(orderedKeepSegments(moved!)).toEqual([[4000, 10_000], [0, 4000]])

    const gapped = moveVideoSegmentWithGap(ctx(edits), 'seg:4000', 'seg:0')
    expect(gapped).not.toBeNull()
    expect(gapped!.inserts?.some((i) => i.sourceId === 'gap' && i.durMs === 6000)).toBe(true)

    const shifted = shiftVideoSegmentWithinSlot(ctx(edits), 'seg:4000', 500)
    expect(shifted?.inserts?.some((i) => i.sourceId === 'gap' && i.durMs === 500)).toBe(true)
    expect(shiftVideoSegmentWithinSlot(ctx(edits), 'seg:4000', -500)).toBeNull()
  })

  it('AR05 zoom keeps Fit exact while preserving the normal zoom readout', () => {
    const fit = fitPxPerSec(60_000, 900)
    expect(trackWidthPx(60_000, fit, 900)).toBe(900)
    expect(zoomPercent(TIMELINE_DEFAULT_PX_PER_SEC)).toBe(100)
    expect(fit).toBeLessThan(TIMELINE_DEFAULT_PX_PER_SEC)
  })

  it('AR06 delete/save/reload clears removed optional edit state instead of resurrecting it', () => {
    const edited = base({ videoSplits: [4000] })
    const persisted = mergeEditsPatch(base(), editsPayloadForSave(edited), bounds)
    expect(persisted.videoSplits).toEqual([4000])
    const undone = base()
    const reloaded = normalizeEdits(
      mergeEditsPatch(persisted, editsPayloadForSave(undone), bounds),
      bounds,
    )
    expect(reloaded.videoSplits).toBeUndefined()
    expect(reloaded.trim).toEqual(undone.trim)
  })

  it('AR07 transform number drafts commit on blur without Enter and retain the prior field', () => {
    let edits = base()
    const onCommit = vi.fn((next: ClipEditsV2) => { edits = next })
    const ui = render(
      <KeyframeInspector
        edits={edits}
        target="video"
        label="Video"
        localMs={2000}
        onCommit={onCommit}
        onSeekLocal={vi.fn()}
        readOnly={false}
        props={['x', 'rotation']}
      />,
    )
    const x = ui.getByTestId('kf-value-x') as HTMLInputElement
    fireEvent.change(x, { target: { value: '12' } })
    fireEvent.blur(x)
    expect(layerTransformAt(edits, 'video', 2000).x).toBe(12)

    ui.rerender(
      <KeyframeInspector
        edits={edits}
        target="video"
        label="Video"
        localMs={2000}
        onCommit={onCommit}
        onSeekLocal={vi.fn()}
        readOnly={false}
        props={['x', 'rotation']}
      />,
    )
    const rotation = ui.getByTestId('kf-value-rotation') as HTMLInputElement
    fireEvent.change(rotation, { target: { value: '30' } })
    fireEvent.blur(rotation)
    expect(layerTransformAt(edits, 'video', 2000)).toMatchObject({ x: 12, rotation: 30 })
  })

  it('AR08/AR09 color edits do not invent motion keyframes and pixelate 80 stays a finite render block', () => {
    const withMotion = toggleKeyframeAt(base(), 'video', 'scale', 1000)
    const colored = { ...withMotion, color: setVideoLook(withMotion.color, { exposure: 12 }) }
    expect(colored.keyframes).toEqual(withMotion.keyframes)
    const block = pixelateBlock(80, 1920, 1080)
    expect(block).toBeGreaterThan(0)
    expect(block % 2).toBe(0)
    expect(block).toBeLessThan(Math.min(1920, 1080))
  })

  it('AR10 keyframe diamond semantics add/remove the selected target value without changing the look', () => {
    let edits = setPropertyAt(base(), 'video', 'scale', 0, 140)
    edits = toggleKeyframeAt(edits, 'video', 'scale', 1000)
    expect(findTrack(edits, 'video', 'scale')?.points).toEqual([{ tMs: 1000, v: 140 }])
    edits = toggleKeyframeAt(edits, 'video', 'scale', 1000)
    expect(findTrack(edits, 'video', 'scale')).toMatchObject({ value: 140, points: [] })
    expect(layerTransformAt(edits, 'video', 1000).scale).toBe(140)
  })

  it('AR11 2x timeline mapping round-trips source time and leaves inserted time unscaled', () => {
    expect(speedDisplayMs(IDENTITY_TIME_MAP, 8000, 2)).toBe(4000)
    expect(speedBaseMs(IDENTITY_TIME_MAP, 4000, 2, 10_000)).toBe(8000)
  })

  it('AR12 caption drag is position-only geometry; media crop/keyframe state remains separate', () => {
    const delta = captionDragDelta(36, 64, 360, 640)
    expect(delta).toEqual({ dCapX: 10, dCapY: -10 })
    const edits = setPropertyAt(base(), 'video', 'cropL', 0, 12)
    expect(findTrack(edits, 'video', 'cropL')).toBeTruthy()
    expect(edits.captions?.position).toBe(base().captions?.position)
  })

  it('AR13/AR15 layout/export contracts keep facecam and landscape mappings distinct', () => {
    expect(editorLayoutToWorker('facecam_stack')).toBe('stack')
    expect(editorLayoutToWorker('screen_pip')).toBe('screen_pip')
    expect(editorLayoutToWorker('fit_top')).toBe('fit')
    expect(exportPixelSize('16:9', '1080p')).toEqual({ width: 1920, height: 1080 })
    expect(exportPixelSize('9:16', '1080p')).toEqual({ width: 1080, height: 1920 })
  })

  it('AR14 opacity clamps, export quality dimensions are stable, and loop wraps only when enabled', () => {
    const opaque = setPropertyAt(base(), 'video', 'opacity', 0, 180)
    expect(layerTransformAt(opaque, 'video', 0).opacity).toBe(100)
    expect(exportPixelSize('16:9', '720p')).toEqual({ width: 1280, height: 720 })
    expect(loopSeekAtOutput(12_000, 6240, 10_340, true, true)).toBe(6240)
    expect(loopSeekAtOutput(12_000, 6240, 10_340, false, true)).toBeNull()
  })

  it('AR16 missing media target does not invent footage or mutate the existing edits', () => {
    const edits = base({
      broll: [{ id: 'b1', source: 'upload', uploadId: 'up_existing', startMs: 1000, endMs: 3000 }],
    })
    const replacement: ProjectMediaItem = {
      id: 'lib_new',
      ref: 'upload',
      refId: 'up_new',
      mediaType: 'video',
      label: 'replacement.mp4',
      durationMs: 5000,
      width: 1920,
      height: 1080,
      url: null,
      syncMs: null,
      syncStatus: 'none',
    }
    const result = replaceBrollMedia(edits, 'deleted_or_missing', replacement)
    expect(result.edits).toBeNull()
    expect(edits.broll?.[0]?.uploadId).toBe('up_existing')
  })
})
