import { describe, expect, it } from 'vitest'
import { buildSrtFromCaptionWords, defaultEdits, formatSrtTime, normalizeEdits, type ClipEditsV2 } from '../lib/clips/edits'
import {
  CAPTION_SYNC_DRIFT_MS,
  detectCaptionSyncIssues,
  primaryCaptionSyncWarning,
} from '../lib/clips/editor/caption-sync-warning'
import { buildNleCaptionsSrt } from '../lib/clips/export-nle-captions'
import { PUBLISHED_EDITOR_WORDS_EXCERPT_40 } from './fixtures/published-editor-words-excerpt-40'

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
    // Real UI path: normalizeEdits drops inverted times and sorts lines, but
    // the detector still surfaces those dropped / reordered cues.
    const invalid = edits({
      captionLines: [
        { id: 'a', text: 'First cue', startMs: 1200, endMs: 800 },
        { id: 'b', text: 'Second cue', startMs: 1200, endMs: 2400 },
      ],
    })
    expect(invalid.captionLines?.some((l) => l.endMs < l.startMs)).toBe(false)
    expect(detectCaptionSyncIssues({ words, edits: invalid }).map((w) => w.code)).toContain(
      'invalid_times',
    )

    const unordered = edits({
      captionLines: [
        { id: 'a', text: 'later', startMs: 1200, endMs: 1800 },
        { id: 'c', text: 'earlier', startMs: 100, endMs: 400 },
      ],
    })
    expect(detectCaptionSyncIssues({ words, edits: unordered }).map((w) => w.code)).toContain(
      'non_monotonic',
    )
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

function linesFromWords(
  source: readonly { w: string; s: number; e: number }[],
  offsetMs: number,
  wordsPerLine = 2,
  gradual = false,
) {
  const cueCount = Math.ceil(source.length / wordsPerLine)
  const lines = []
  for (let i = 0; i < source.length; i += wordsPerLine) {
    const group = source.slice(i, i + wordsPerLine)
    const cueIndex = i / wordsPerLine
    const shift = gradual ? Math.round((cueIndex / Math.max(1, cueCount - 1)) * offsetMs) : offsetMs
    lines.push({
      id: `l${i}`,
      text: group.map((w) => w.w).join(' '),
      startMs: Math.round(group[0]!.s * 1000) + shift,
      endMs: Math.round(group[group.length - 1]!.e * 1000) + shift,
    })
  }
  return lines
}

describe('caption sync drift matching', () => {
  const excerpt = [...PUBLISHED_EDITOR_WORDS_EXCERPT_40]
  const denseBounds = { clipStartMs: 0, clipEndMs: 12_000 }

  function denseEdits(offsetMs: number, gradual = false) {
    return normalizeEdits(
      {
        ...defaultEdits(denseBounds),
        captionLines: linesFromWords(excerpt, offsetMs, 2, gradual),
      },
      denseBounds,
    )
  }

  // Thresholds: inclusive 500ms. +150 and +300 stay quiet so slight ASR slack
  // does not block export; +500 and +1000 fire so a visible constant shift cannot ship.
  it('flags the VQ repro: 40 words, 2 per line, every cue shifted +1000ms', () => {
    const found = detectCaptionSyncIssues({ words: excerpt, edits: denseEdits(1000) })
    expect(found.map((w) => w.code)).toContain('line_transcript_drift')
  })

  it('stays quiet for a constant +150ms offset', () => {
    expect(detectCaptionSyncIssues({ words: excerpt, edits: denseEdits(150) }).map((w) => w.code)).not.toContain(
      'line_transcript_drift',
    )
  })

  it('stays quiet for a constant +300ms offset', () => {
    expect(detectCaptionSyncIssues({ words: excerpt, edits: denseEdits(300) }).map((w) => w.code)).not.toContain(
      'line_transcript_drift',
    )
  })

  it('warns for a constant +500ms offset (inclusive threshold)', () => {
    expect(detectCaptionSyncIssues({ words: excerpt, edits: denseEdits(500) }).map((w) => w.code)).toContain(
      'line_transcript_drift',
    )
  })

  it('warns for a constant +1000ms offset', () => {
    expect(detectCaptionSyncIssues({ words: excerpt, edits: denseEdits(1000) }).map((w) => w.code)).toContain(
      'line_transcript_drift',
    )
  })

  it('warns when cue offsets gradually ramp to 1000ms', () => {
    expect(
      detectCaptionSyncIssues({ words: excerpt, edits: denseEdits(1000, true) }).map((w) => w.code),
    ).toContain('line_transcript_drift')
  })

  it('stays quiet when the same dense cues are in sync', () => {
    expect(detectCaptionSyncIssues({ words: excerpt, edits: denseEdits(0) })).toEqual([])
  })
})

describe('NLE / export SRT caption case', () => {
  it('applies upper and sentence case the same way preview/ASS do', () => {
    const base = edits({
      captionLines: [{ id: 'cl', text: 'Hello there\npals', startMs: 200, endMs: 1600 }],
    })
    const upper = {
      ...base,
      captions: { ...base.captions, case: 'upper' },
    }
    const upperSrt = buildNleCaptionsSrt(words, upper, bounds)
    expect(upperSrt).toContain('HELLO THERE')
    expect(upperSrt).toContain('PALS')
    expect(upperSrt).not.toContain('Hello there')

    const sentence = {
      ...base,
      captions: { ...base.captions, case: 'sentence' },
    }
    const sentenceSrt = buildNleCaptionsSrt(words, sentence, bounds)
    expect(sentenceSrt).toContain('Hello there')
    expect(sentenceSrt).toContain('pals')
    expect(sentenceSrt).not.toContain('HELLO THERE')
  })
})
