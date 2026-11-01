// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Timeline } from '@/components/clips/editor/timeline'
import { SourceMonitor } from '@/components/clips/editor/source-monitor'
import { TranscriptPanel, type TranscriptSelection } from '@/components/clips/editor/transcript-panel'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import type { ClipMediaSource } from '@/lib/clips/editor/sources'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { insertFromSource } from '@/lib/clips/editor/source-monitor'
import {
  MAIN_ANGLE,
  setAngleForSourceSpan,
} from '@/lib/clips/editor/multicam-manual'
import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'
import type { SourceWord } from '@/lib/clips/source-words'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const cam2: ClipMediaSource = { id: 'u2', ref: 'upload', refId: 'u2', mediaType: 'video', label: 'angle2_apex', syncMs: 0 }
const lib = [cam2]
const base = (patch: Partial<ClipEditsV2> = {}): ClipEditsV2 => ({ ...normalizeEdits(defaultEdits(bounds), bounds), ...patch })

describe('MC-05 / MC-06 multicam on script selection', () => {
  it('setAngleForSourceSpan maps a main-source word span (not timeline start)', () => {
    const e = base()
    const tb = timebaseFor(e)
    const next = setAngleForSourceSpan(e, tb, 1000, 2800, 'u2', lib)
    expect(next.sourceSegments).toEqual([{ id: 'mc-1000', sourceId: 'u2', startMs: 1000, endMs: 2800 }])
    expect(next.sourceSegments![0]!.startMs).toBeGreaterThan(0)
  })

  it('MC-06: switching back to Main stores an explicit main segment on the span', () => {
    const e = setAngleForSourceSpan(base(), timebaseFor(base()), 1000, 3000, 'u2', lib)
    const back = setAngleForSourceSpan(e, timebaseFor(e), 1000, 3000, MAIN_ANGLE, lib)
    expect(back.sourceSegments).toEqual([{ id: 'mc-1000', sourceId: MAIN_ANGLE, startMs: 1000, endMs: 3000 }])
  })

  it('timeline key 2 with script selection applies angle on the word span, not the parked playhead', () => {
    const onCommitEdits = vi.fn()
    const selectionRef: { current: TranscriptSelection | null } = {
      current: { startMs: 1000, endMs: 3000, clear: () => {} },
    }
    render(
      <Timeline
        edits={base()}
        words={[]}
        shots={[]}
        outputMs={0}
        clipOutputDurationMs={20000}
        onSeekOutput={() => {}}
        clipStartMs={0}
        clipEndMs={20000}
        trimMinMs={0}
        trimMaxMs={40000}
        onCommitEdits={onCommitEdits}
        angleSources={lib}
        transcriptSelectionRef={selectionRef}
      />,
    )
    fireEvent.keyDown(window, { key: '2' })
    expect(onCommitEdits).toHaveBeenCalledTimes(1)
    const next = onCommitEdits.mock.calls[0]![0] as ClipEditsV2
    expect(next.sourceSegments).toEqual([{ id: 'mc-1000', sourceId: 'u2', startMs: 1000, endMs: 3000 }])
  })

  it('transcript context menu offers Camera entries for the selection', () => {
    const words: SourceWord[] = [
      { i: 0, s: 1, e: 1.4, w: 'one' },
      { i: 1, s: 1.5, e: 1.9, w: 'two' },
      { i: 2, s: 2, e: 2.5, w: 'three' },
    ]
    const onSetEdits = vi.fn()
    render(
      <TranscriptPanel
        words={words}
        shots={[]}
        edits={base()}
        onSeek={() => {}}
        onAddCut={() => {}}
        onWordFix={() => {}}
        onRestoreWord={() => {}}
        onExtendTrim={() => {}}
        selectionRef={{ current: null }}
        onSetEdits={onSetEdits}
        angleSources={lib}
      />,
    )
    fireEvent.click(screen.getByText('one'))
    fireEvent.click(screen.getByText('two'), { shiftKey: true })
    fireEvent.contextMenu(screen.getByText('one'))
    expect(screen.getByTestId('transcript-ctx-menu')).toBeTruthy()
    fireEvent.click(screen.getByTestId('transcript-ctx-angle-u2'))
    expect(onSetEdits).toHaveBeenCalled()
    const seg = (onSetEdits.mock.calls[0]![0] as ClipEditsV2).sourceSegments
    expect(seg?.[0]).toMatchObject({ sourceId: 'u2', startMs: 1000 })
  })
})

describe('live playhead for insert / overwrite', () => {
  afterEach(() => cleanup())

  it('insertFromSource uses output playhead ms (unit)', () => {
    const e = base()
    const tb = timebaseFor(e)
    const vid: ProjectMediaItem = {
      id: 'u1',
      ref: 'upload',
      refId: 'up1',
      mediaType: 'video',
      label: 'Guest',
      durationMs: 60000,
      width: 1920,
      height: 1080,
      url: 'https://x/v.mp4',
      syncMs: null,
      syncStatus: 'none',
    }
    const at1000 = insertFromSource(e, vid, tb, 1000, [500, 1500], () => 'ins1')
    expect(at1000.edits!.inserts![0]!.atSrcMs).toBe(1000)
    const at0 = insertFromSource(e, vid, tb, 0, [500, 1500], () => 'ins2')
    expect(at0.edits!.inserts![0]!.atSrcMs).toBe(0)
  })

  it('SourceMonitor Insert reads playheadOutMsRef when prop is stale', () => {
    const playheadOutMsRef = { current: 1000 }
    const onEdits = vi.fn()
    const vid: ProjectMediaItem = {
      id: 'u1',
      ref: 'upload',
      refId: 'up1',
      mediaType: 'video',
      label: 'Guest',
      durationMs: 60000,
      width: 1920,
      height: 1080,
      url: 'https://x/v.mp4',
      syncMs: null,
      syncStatus: 'none',
    }
    const words = [{ w: 'hi', s: 0.5, e: 1.0 }]
    render(
      <SourceMonitor
        items={[vid]}
        transcripts={[{ ref: 'upload', refId: 'up1', status: 'done', words }]}
        request={null}
        edits={base()}
        tb={timebaseFor(base())}
        playheadOutMs={0}
        playheadOutMsRef={playheadOutMsRef}
        onEdits={onEdits}
      />,
    )
    fireEvent.change(screen.getByTestId('source-monitor-item'), { target: { value: 'u1' } })
    fireEvent.click(screen.getByText('hi'))
    fireEvent.click(screen.getByRole('button', { name: /insert at playhead/i }))
    expect(onEdits).toHaveBeenCalled()
    expect(onEdits.mock.calls[0]![0].inserts![0]!.atSrcMs).toBe(1000)
  })
})
