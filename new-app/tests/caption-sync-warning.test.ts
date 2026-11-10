import { describe, expect, it } from 'vitest'
import { buildSrtFromCaptionWords, defaultEdits, formatSrtTime, normalizeEdits, type ClipEditsV2 } from '../lib/clips/edits'
import {
  CAPTION_SYNC_DRIFT_MS,
  detectCaptionSyncIssues,
  primaryCaptionSyncWarning,
} from '../lib/clips/editor/caption-sync-warning'
import { buildNleCaptionsSrt } from '../lib/clips/export-nle-captions'

const bounds = { clipStartMs: 0, clipEndMs: 10_000 }

const words = [
  { i: 0, w: 'Hello', s: 0.2, e: 0.6 },
  { i: 1, w: 'there', s: 0.6, e: 1.0 },
  { i: 2, w: 'friends', s: 1.1, e: 1.6 },
  { i: 3, w: 'today', s: 2.0, e: 2.4 },
]

function edits(overrides: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return normalizeEdits({ ...defaultEdits(bounds), ...overrides }, bounds)
}

describe('caption sync warning', () => {
  it('stays quiet when word timings match the edited clip', () => {
    expect(detectCaptionSyncIssues({ words, edits: edits() })).toEqual([])
  })

  it('stays quiet when words have not loaded yet', () => {
    expect(detectCaptionSyncIssues({ words: [], edits: edits() })).toEqual([])
  })

  it('stays quiet when captions are disabled', () => {
    const next = edits({
      captions: { enabled: false, presetId: 'bold_pop' },
      captionLines: [{ id: 'a', text: 'x', startMs: 80_000, endMs: 81_000 }],
    })
    expect(detectCaptionSyncIssues({ words, edits: next })).toEqual([])
  })

  it('warns when manual lines sit far from the transcript', () => {
    const next = edits({
      captionLines: [
        { id: 'a', text: 'Hello', startMs: 5000, endMs: 5600 },
        { id: 'b', text: 'there', startMs: 5700, endMs: 6300 },
        { id: 'c', text: 'friends', startMs: 6400, endMs: 7000 },
      ],
    })
    const found = detectCaptionSyncIssues({ words, edits: next })
    expect(found.some((w) => w.code === 'line_transcript_drift')).toBe(true)
    expect(primaryCaptionSyncWarning({ words, edits: next })?.level).toBe('warning')
    expect(CAPTION_SYNC_DRIFT_MS).toBe(500)
  })

  it('warns when cues look like source-file time, not the cut', () => {
    const next = edits({
      trim: { in: 60_000, out: 70_000 },
      captionLines: [
        { id: 'a', text: 'Hello', startMs: 60_000, endMs: 60_600 },
        { id: 'b', text: 'there', startMs: 60_700, endMs: 61_200 },
      ],
    })
    const found = detectCaptionSyncIssues({ words, edits: next })
    expect(found.some((w) => w.code === 'source_clock' || w.code === 'past_duration')).toBe(true)
  })

  it('warns on invalid or out-of-order cues', () => {
    // Check the raw cues. normalizeEdits drops inverted times and sorts lines,
    // which would hide the condition the export warning is meant to catch.
    const base = edits()
    const invalid = detectCaptionSyncIssues({
      words,
      edits: { ...base, captionLines: [{ id: 'a', text: 'b', startMs: 1200, endMs: 800 }] },
    })
    expect(invalid.map((w) => w.code)).toContain('invalid_times')

    const unordered = detectCaptionSyncIssues({
      words,
      edits: {
        ...base,
        captionLines: [
          { id: 'a', text: 'later', startMs: 1200, endMs: 1800 },
          { id: 'c', text: 'earlier', startMs: 100, endMs: 400 },
        ],
      },
    })
    expect(unordered.map((w) => w.code)).toContain('non_monotonic')
  })

  it('word and line edits still flow into SRT when timings are valid', () => {
    const next = edits({
      wordFixes: { '1': 'friends' },
      captionLines: [{ id: 'cl', text: 'Hello friends today', startMs: 200, endMs: 2400 }],
    })
    expect(detectCaptionSyncIssues({ words, edits: next })).toEqual([])
    const srt = buildNleCaptionsSrt(words, next, bounds)
    expect(srt).toContain('Hello friends today')
    expect(srt).not.toContain('Hello there friends')
  })
})

describe('SRT timestamp formatting and empty file', () => {
  it('formats SRT timestamps with zero-padded hours, minutes, seconds, and milliseconds', () => {
    expect(formatSrtTime(0)).toBe('00:00:00,000')
    expect(formatSrtTime(1.5)).toBe('00:00:01,500')
    expect(formatSrtTime(61.042)).toBe('00:01:01,042')
    expect(formatSrtTime(3661.5)).toBe('01:01:01,500')
  })

  it('returns an empty string when there are no caption words or lines', () => {
    expect(buildSrtFromCaptionWords([])).toBe('')
    expect(buildNleCaptionsSrt([], edits(), bounds)).toBe('')
  })

  it('skips blank and inverted cues so the file stays empty or well-formed', () => {
    expect(
      buildSrtFromCaptionWords([
        { text: '   ', s_ms: 0, e_ms: 400 },
        { text: 'Hi', s_ms: 800, e_ms: 400 },
      ]),
    ).toBe('')
    const srt = buildSrtFromCaptionWords([{ text: 'Hi', s_ms: 0, e_ms: 400 }])
    expect(srt).toContain('00:00:00,000 --> 00:00:00,400')
    expect(srt).toContain('Hi')
  })
})
