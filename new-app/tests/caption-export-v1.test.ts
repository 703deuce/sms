import { describe, expect, it } from 'vitest'
import { ASR_LANGUAGES } from '@/lib/clips/asr-languages'
import { normalizeCaptionPresetConfig } from '@/lib/clips/caption-style-config'
import {
  captionSyncExportDecision,
  detectCaptionSyncIssues,
} from '@/lib/clips/caption-sync-guard'
import { defaultEdits } from '@/lib/clips/edits'
import {
  buildNleCaptionLines,
  buildNleCaptionsSrt,
  buildNleCaptionsVtt,
} from '@/lib/clips/export-nle-captions'
import { clipProjectSettingsSchema } from '@/lib/clips/settings'

const bounds = { clipStartMs: 0, clipEndMs: 10_000 }
const words = [
  { i: 0, w: 'Hello', s: 0.4, e: 0.8 },
  { i: 1, w: 'world', s: 0.9, e: 1.3 },
  { i: 2, w: 'later', s: 5.0, e: 5.4 },
]

describe('SRT and VTT honor wordFixes, captionLines, and cuts', () => {
  it('uses wordFixes text in both SRT and VTT', () => {
    const edits = {
      ...defaultEdits(bounds),
      wordFixes: { '0': 'Howdy' },
    }
    const srt = buildNleCaptionsSrt(words, edits, bounds)
    const vtt = buildNleCaptionsVtt(words, edits, bounds)
    expect(srt).toContain('Howdy')
    expect(srt).not.toContain('Hello')
    expect(vtt).toContain('WEBVTT')
    expect(vtt).toContain('Howdy')
    expect(vtt).not.toContain('Hello')
    expect(vtt).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3} --> /)
    expect(vtt).not.toMatch(/\d{2}:\d{2}:\d{2},\d{3} --> /)
  })

  it('uses manual captionLines text instead of the transcript words', () => {
    const edits = {
      ...defaultEdits(bounds),
      wordFixes: { '0': 'Howdy' },
      captionLines: [{ id: 'cl_custom', text: 'Custom line', startMs: 400, endMs: 1300 }],
    }
    const srt = buildNleCaptionsSrt(words, edits, bounds)
    const vtt = buildNleCaptionsVtt(words, edits, bounds)
    expect(srt).toContain('Custom line')
    expect(srt).not.toContain('Howdy')
    expect(srt).not.toContain('Hello')
    expect(vtt).toContain('Custom line')
    expect(vtt).not.toContain('Hello')
  })

  it('remaps cue times across a mid-clip cut to the rendered clock', () => {
    const base = defaultEdits(bounds)
    const edits = {
      ...base,
      cutRanges: [[1000, 5000]] as [number, number][],
      captions: { ...base.captions, wordsPerLine: 1 },
    }
    const srt = buildNleCaptionsSrt(words, edits, bounds)
    const vtt = buildNleCaptionsVtt(words, edits, bounds)
    const lines = buildNleCaptionLines(words, edits, bounds)
    const later = lines.find((l: {text: string; startMs: number}) => /\blater\b/i.test(l.text))
    expect(later).toBeTruthy()
    // "world" (mid 1100ms) is inside the cut. "later" at source 5000ms
    // maps to 1000ms on the output clock after the 4000ms deletion.
    expect(later!.startMs).toBeGreaterThanOrEqual(900)
    expect(later!.startMs).toBeLessThan(1600)
    expect(srt).toContain('later')
    expect(srt).not.toContain('world')
    expect(srt).toContain('00:00:01')
    expect(srt).not.toContain('00:00:05')
    expect(vtt).toContain('00:00:01')
    expect(vtt).not.toContain('00:00:05')
  })
})

describe('caption style preset config', () => {
  it('persists the v1 snapshot keys and drops per-clip text fields', () => {
    const saved = normalizeCaptionPresetConfig({
      version: 1,
      presetId: 'clean-white',
      font: 'Poppins',
      animation: 'none',
      size: 6,
      userSizePct: 6,
      position: 'bottom',
      case: 'sentence',
      wordsPerLine: 2,
      colors: { a: '#FFFFFF', b: '#2563EB' },
      keywordHighlight: false,
      autoEmojis: false,
      marginVPct: 12,
      activeStyle: 'color',
      highlightColor: '#FDE047',
      emojiByWord: { '0': '🔥' },
      emphasis: [0, 2],
      captionLines: [{ id: 'x', text: 'nope', startMs: 0, endMs: 1 }],
      wordFixes: { '0': 'nope' },
    })
    expect(saved.presetId).toBe('clean-white')
    expect(saved.font).toBe('Poppins')
    expect(saved.keywordHighlight).toBe(false)
    expect(saved.autoEmojis).toBe(false)
    expect(saved.emojiByWord).toBeUndefined()
    expect(saved.emphasis).toBeUndefined()
    expect(saved.captionLines).toBeUndefined()
    expect(saved.wordFixes).toBeUndefined()
    expect(saved.version).toBe(1)
  })
})

describe('asrLanguage settings schema', () => {
  it('accepts every published language in asr-languages.ts', () => {
    for (const { code } of ASR_LANGUAGES) {
      const parsed = clipProjectSettingsSchema.safeParse({ v: 2, asrLanguage: code })
      expect(parsed.success, code).toBe(true)
      if (parsed.success) expect(parsed.data.asrLanguage).toBe(code)
    }
  })

  it('rejects a language that is not on the published list', () => {
    expect(clipProjectSettingsSchema.safeParse({ v: 2, asrLanguage: 'xx' }).success).toBe(false)
    expect(clipProjectSettingsSchema.safeParse({ v: 2, asrLanguage: '100+' }).success).toBe(false)
  })
})

describe('export-time caption sync guard', () => {
  it('does not block a self-consistent caption timeline', () => {
    const edits = defaultEdits(bounds)
    const decision = captionSyncExportDecision({ words, edits, durationMs: 10_000 })
    expect(decision.blocked).toBe(false)
  })

  it('blocks a drifted export until captionSyncAck is true, and never implies a retry', () => {
    const edits = {
      ...defaultEdits(bounds),
      captionLines: [
        { id: 'a', text: 'Hello', startMs: 400, endMs: 800 },
        { id: 'b', text: 'world', startMs: 900, endMs: 1300 },
        { id: 'c', text: 'later', startMs: 8000, endMs: 8400 },
      ],
    }
    const warnings = detectCaptionSyncIssues({ words, edits, durationMs: 2000 })
    expect(warnings.some((w: { code: string }) => w.code === 'past_duration' || w.code === 'line_transcript_drift')).toBe(true)
    const blocked = captionSyncExportDecision({ words, edits, durationMs: 2000, format: 'mp4' })
    expect(blocked.blocked).toBe(true)
    const acked = captionSyncExportDecision({
      words,
      edits,
      durationMs: 2000,
      format: 'mp4',
      captionSyncAck: true,
    })
    expect(acked.blocked).toBe(false)
    expect(acked.warnings.length).toBeGreaterThan(0)
  })

  it('skips the gate for audio-only or preview-wysiwyg exports', () => {
    const edits = {
      ...defaultEdits(bounds),
      captionLines: [{ id: 'x', text: 'bad', startMs: 8000, endMs: 8400 }],
    }
    expect(captionSyncExportDecision({ words, edits, durationMs: 2000, format: 'mp3' }).blocked).toBe(false)
    expect(captionSyncExportDecision({ words, edits, durationMs: 2000, previewWysiwyg: true }).blocked).toBe(false)
    expect(
      captionSyncExportDecision({
        words,
        edits,
        durationMs: 2000,
        captionsEnabled: false,
      }).blocked,
    ).toBe(false)
  })
})
