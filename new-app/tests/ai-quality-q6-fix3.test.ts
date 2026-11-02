import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits, type ClipWord } from '@/lib/clips/edits'
import { inferShotsFromWords } from '@/lib/clips/crop-shots'
import { mergeClipWordsWithProjectTranscript } from '@/lib/clips/editor-words-merge'
import { overlappingSpeakerRangesFromWords, splitScreenOverlapMessage } from '@/lib/clips/editor/reframe-overlap'
import { normalizeLayoutSegments } from '@/lib/clips/layout-segments'
import { normalizeTranscriptWord } from '@/lib/server/clips/editor-words'
import { loadSourceWords } from '@/lib/clips/source-words'
import type { SourceWord } from '@/lib/clips/source-words'

/** Synthetic diarized timeline matching clip_d46c686b density (trim 0–15400 ms). */
export function clipD46c686Words(): SourceWord[] {
  const raw: ClipWord[] = []
  let t = 0
  let i = 0
  while (t < 15.4) {
    const spk = i % 2
    const dur = 0.35 + (i % 3) * 0.12
    const gap = i % 4 === 3 ? 0.85 : i % 5 === 0 ? 0.05 : 0.25
    raw.push({ w: `w${i}`, s: t, e: t + dur, spk, i })
    t += dur + gap
    i += 1
  }
  raw.push({ w: 'tail', s: 14.2, e: 15.4, spk: 1, i: i + 1 })
  return loadSourceWords(raw)
}

/** Rapid A/B exchange over 7 s — merges to one split span after 1.5 s filter. */
export function fastAbExchange7sWords(): SourceWord[] {
  const raw: ClipWord[] = []
  let t = 0
  let i = 0
  while (t < 7) {
    raw.push({ w: `w${i}`, s: t, e: t + 0.55, spk: i % 2, i })
    t += 0.55 + 0.08
    i += 1
  }
  return loadSourceWords(raw)
}

const D46_EXPECTED = [
  { startMs: 0, endMs: 2310 },
  { startMs: 3160, endMs: 5590 },
  { startMs: 6440, endMs: 8990 },
  { startMs: 9840, endMs: 12350 },
  { startMs: 13200, endMs: 15400 },
]

describe('Q6-fix3 speaker labels + reframe overlap', () => {
  it('normalizeTranscriptWord keeps numeric spk (Deepgram speaker field)', () => {
    const w = normalizeTranscriptWord({ w: 'hey', s: 1, e: 2, spk: 2, i: 3 }, 0)
    expect(w?.spk).toBe(2)
    const w2 = normalizeTranscriptWord({ word: 'yo', start: 1, end: 2, speaker: 1 }, 1)
    expect(w2?.spk).toBe(1)
  })

  it('mergeClipWordsWithProjectTranscript backfills spk from project index', () => {
    const clip = loadSourceWords([{ w: 'mid', s: 15, e: 16, i: 5 }])
    const project = loadSourceWords([{ w: 'mid', s: 15, e: 16, spk: 1, i: 5 }])
    const merged = mergeClipWordsWithProjectTranscript(clip, project, 10_000, 40_000)
    expect(merged.find((w) => w.i === 5)?.spk).toBe(1)
  })

  it('inferShotsFromWords alternates third+ speakers A/B by first appearance', () => {
    const words = loadSourceWords([
      { w: 'a', s: 0, e: 1, spk: 2, i: 0 },
      { w: 'b', s: 2, e: 3, spk: 5, i: 1 },
      { w: 'c', s: 4, e: 5, spk: 7, i: 2 },
    ])
    const shots = inferShotsFromWords(words, 0, 6000)
    expect(shots.some((s) => s.speaker === 'A' && s.cx === 30)).toBe(true)
    expect(shots.some((s) => s.speaker === 'B' && s.cx === 70)).toBe(true)
    expect(shots.filter((s) => s.speaker === 'C').length).toBe(0)
  })

  it('overlap detect requires speaker labels (missing spk is not speaker 0)', () => {
    const words = loadSourceWords([
      { w: 'a', s: 0, e: 2, i: 0 },
      { w: 'b', s: 1, e: 3, i: 1 },
    ])
    const r = overlappingSpeakerRangesFromWords(words, 0, 10_000)
    expect(r.reason).toBe('no_speaker_labels')
    expect(r.ranges).toEqual([])
    expect(splitScreenOverlapMessage(r)).toMatch(/no speaker labels/i)
  })

  it('true overlap fixture yields exact merged span', () => {
    const words = loadSourceWords([
      { w: 'a', s: 0, e: 3, spk: 0, i: 0 },
      { w: 'b', s: 1, e: 4, spk: 1, i: 1 },
    ])
    const r = overlappingSpeakerRangesFromWords(words, 0, 10_000)
    expect(r.reason).toBe('ok')
    expect(r.ranges).toEqual([{ startMs: 0, endMs: 4000 }])
  })

  it('clip_d46c686 fixture yields exact split spans (back-and-forth merge)', () => {
    const r = overlappingSpeakerRangesFromWords(clipD46c686Words(), 0, 15_400)
    expect(r.reason).toBe('ok')
    expect(r.ranges).toEqual(D46_EXPECTED)
  })

  it('fast 7 s A/B exchange yields one merged span', () => {
    const r = overlappingSpeakerRangesFromWords(fastAbExchange7sWords(), 0, 7000)
    expect(r.reason).toBe('ok')
    expect(r.ranges).toEqual([{ startMs: 0, endMs: 7000 }])
  })

  it('normalizeLayoutSegments preserves facecam_stack and facecam_pip', () => {
    const segs = normalizeLayoutSegments(
      [
        { startMs: 0, endMs: 5000, mode: 'facecam_stack' },
        { startMs: 5000, endMs: 10_000, mode: 'facecam_pip' },
      ],
      0,
      10_000,
      'speaker_follow',
    )
    expect(segs.map((s) => s.mode)).toEqual(['facecam_stack', 'facecam_pip'])
  })

  it('split layout segments are preserved on normalizeEdits (export path)', () => {
    const bounds = { clipStartMs: 0, clipEndMs: 20_000 }
    const edits = normalizeEdits(
      {
        ...defaultEdits(bounds),
        layout: {
          mode: 'speaker_follow',
          shotOverrides: [],
          splitScreenFallback: true,
          layoutSegments: [
            { startMs: 0, endMs: 4000, mode: 'speaker_follow' },
            { startMs: 4000, endMs: 9000, mode: 'split', auto: true },
            { startMs: 9000, endMs: 20_000, mode: 'speaker_follow' },
          ],
        },
      },
      bounds,
    )
    const modes = edits.layout.layoutSegments?.map((s) => s.mode)
    expect(modes).toContain('split')
  })
})
