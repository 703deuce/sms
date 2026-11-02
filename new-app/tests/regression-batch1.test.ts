import { describe, expect, it } from 'vitest'
import { joinVideoSplits, videoJoinOptions } from '@/lib/clips/editor/clip-timeline'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import { dedupeAdjacentEditorWords } from '@/lib/clips/editor-words-dedupe'
import {
  facecamStackAvailable,
  layoutModeDisabledReason,
  twoSpeakerSplitAvailable,
} from '@/lib/clips/layout-mode-availability'
import { defaultExportDialogState } from '@/lib/clips/export-dialog-defaults'
import {
  alignStepPctWithOverall,
  exportProgressFromSteps,
  formatExportProgressLineMonotonic,
} from '@/lib/clips/export-progress-steps'
import {
  exportActionLabel,
  exportDownloadLabel,
  effectiveAudioDeliverFormat,
} from '@/lib/clips/export-format-labels'
import {
  coerceChapterOutMs,
  normalizeChapterTimeline,
  normalizeChapters,
  buildTimestampedLines,
} from '@/lib/clips/repurpose'
import { normalizeEdits } from '@/lib/clips/edits'
import { loadSourceWords } from '@/lib/clips/source-words'

describe('REGRESSION_BATCH1', () => {
  it('export labels follow audio/gif format', () => {
    expect(exportActionLabel('mp3', ['libx264'])).toBe('Export Audio (M4A)')
    expect(exportDownloadLabel('m4a', ['libmp3lame'])).toBe('Download M4A')
    expect(exportActionLabel('gif')).toBe('Export GIF')
    expect(effectiveAudioDeliverFormat('mp3', ['libx264'])).toBe('m4a')
  })

  it('default export settings come from clip aspect and layout', () => {
    const edits = normalizeEdits(
      {
        aspectRatio: '9:16',
        layout: { mode: 'center_crop' },
        cutRanges: [],
      },
      { startMs: 0, endMs: 60_000 },
    )
    const d = defaultExportDialogState(edits)
    expect(d.aspect).toBe('9:16')
    expect(d.layoutMode).toBe('center_crop')
    expect(d.resolution).toBe('1080p')
  })

  it('export progress stays monotonic and aligned', () => {
    expect(exportProgressFromSteps(0, 0.5, 3)).toBe(17)
    expect(exportProgressFromSteps(1, 0.74, 3)).toBe(58)
    const aligned = alignStepPctWithOverall(58, 74, 3, 2)
    expect(aligned).not.toBeNull()
    if (aligned != null) expect(aligned).toBeLessThanOrEqual(74)
    const line = formatExportProgressLineMonotonic({
      status: 'RUNNING',
      progress: 58,
      phase: 'render_clip',
      etaSec: null,
      detail: { step: 2, steps: 3, stepPct: 74 },
    })
    expect(line).toContain('58%')
  })

  it('chapter timestamp mapping handles seconds and line indices', () => {
    expect(coerceChapterOutMs(45, 180_000)).toBe(45_000)
    const scaled = normalizeChapterTimeline(
      [
        { outMs: 10, label: 'A' },
        { outMs: 20, label: 'B' },
        { outMs: 30, label: 'C' },
      ],
      120_000,
    )
    expect(scaled[2]!.outMs).toBe(30_000)
    const words = loadSourceWords([
      { w: 'hi', s: 0, e: 1, i: 0 },
      { w: 'there', s: 60, e: 61, i: 1 },
    ])
    const edits = normalizeEdits({ cutRanges: [] }, { startMs: 0, endMs: 180_000 })
    const lines = buildTimestampedLines(words, edits)
    const fromSec = normalizeChapters(
      {
        chapters: [
          { start: 10, label: 'A' },
          { start: 40, label: 'B' },
          { start: 80, label: 'C' },
        ],
      },
      lines,
      180_000,
    )
    expect('chapters' in fromSec).toBe(true)
    if ('chapters' in fromSec) {
      expect(fromSec.chapters.some((c) => c.outMs >= 10_000)).toBe(true)
    }
  })

  it('join-adjacent removes a video split between contiguous segments', () => {
    const bounds = { clipStartMs: 0, clipEndMs: 20_000, trimMinMs: 0, trimMaxMs: 40_000 }
    const words = Array.from({ length: 8 }, (_, i) => ({ i, w: `w${i}`, s: i * 0.6, e: i * 0.6 + 0.4 }))
    const edits = normalizeEdits({ cutRanges: [], videoSplits: [5000] }, bounds)
    const previewEdits = editorPreviewEdits(edits, words)
    const opts = videoJoinOptions({ edits, previewEdits }, [{ lane: 'video', id: 'seg:0' }])
    expect(opts.next).toBe(5000)
    const joined = joinVideoSplits({ edits }, [5000])
    expect(joined?.videoSplits).toEqual([])
  })

  it('facecam stack and two-speaker layout availability', () => {
    expect(facecamStackAvailable({ contentType: 'gaming', facecamLayout: null })).toBe(true)
    expect(
      layoutModeDisabledReason('facecam_stack', { contentType: 'talking_head', facecamLayout: null }),
    ).toBe('Needs gameplay + facecam')
    expect(twoSpeakerSplitAvailable([{ spk: 0 }, { spk: 1 }])).toBe(true)
    expect(layoutModeDisabledReason('split', { words: [{ spk: 0 }] })).toBe('Needs 2 speakers')
  })

  it('streamer word dedupe drops adjacent duplicates', () => {
    const words = loadSourceWords([
      { w: 'A', s: 1, e: 1.2, i: 0 },
      { w: 'a', s: 1.01, e: 1.21, i: 1 },
    ])
    expect(dedupeAdjacentEditorWords(words).map((w) => w.w)).toEqual(['A'])
  })
})
