import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits, type ClipWord } from '@/lib/clips/edits'
import { inferShotsFromWords } from '@/lib/clips/crop-shots'
import { mergeClipWordsWithProjectTranscript } from '@/lib/clips/editor-words-merge'
import {
  overlappingSpeakerRangesFromWords,
  splitScreenOverlapMessage,
  type OverlapRange,
} from '@/lib/clips/editor/reframe-overlap'
import { normalizeLayoutSegments } from '@/lib/clips/layout-segments'
import { normalizeTranscriptWord } from '@/lib/server/clips/editor-words'
import { loadSourceWords } from '@/lib/clips/source-words'
import type { SourceWord } from '@/lib/clips/source-words'

/** Pre-fix overlap (spk treated as 0, 200 ms min span, 1500 ms alt gap) — clip_d46c686 baseline. */
function legacyOverlapRanges(words: readonly SourceWord[], rangeStartMs: number, rangeEndMs: number): OverlapRange[] {
  const inRange = words
    .filter((w) => w.e * 1000 > rangeStartMs && w.s * 1000 < rangeEndMs)
    .sort((a, b) => a.s - b.s)
  const ranges: OverlapRange[] = []
  const push = (a: number, b: number) => {
    const startMs = Math.max(rangeStartMs, Math.min(a, b))
    const endMs = Math.min(rangeEndMs, Math.max(a, b))
    if (endMs - startMs >= 200) ranges.push({ startMs, endMs })
  }
  for (let i = 0; i < inRange.length; i++) {
    const wi = inRange[i]!
    const si = wi.spk ?? 0
    const ai = Math.round(wi.s * 1000)
    const bi = Math.round(wi.e * 1000)
    for (let j = i + 1; j < inRange.length; j++) {
      const wj = inRange[j]!
      const aj = Math.round(wj.s * 1000)
      if (aj >= bi) break
      const sj = wj.spk ?? 0
      if (si !== sj) push(ai, Math.max(bi, Math.round(wj.e * 1000)))
    }
    const next = inRange[i + 1]
    if (next && (next.spk ?? 0) !== si) {
      const gap = Math.round(next.s * 1000) - bi
      if (gap >= 0 && gap < 1500) push(ai, Math.round(next.e * 1000))
    }
  }
  ranges.sort((x, y) => x.startMs - y.startMs)
  const merged: OverlapRange[] = []
  for (const r of ranges) {
    const prev = merged[merged.length - 1]
    if (prev && r.startMs <= prev.endMs + 80) prev.endMs = Math.max(prev.endMs, r.endMs)
    else merged.push({ ...r })
  }
  return merged
}

/** Synthetic diarized clip matching clip_d46c686 overlap/back-and-forth density (trim 0–15400 ms). */
function clipD46c686Words(): SourceWord[] {
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

  it('inferShotsFromWords maps diarization ids by first appearance (not all A)', () => {
    const words = loadSourceWords([
      { w: 'a', s: 0, e: 1, spk: 2, i: 0 },
      { w: 'b', s: 2, e: 3, spk: 5, i: 1 },
      { w: 'c', s: 4, e: 5, spk: 2, i: 2 },
    ])
    const shots = inferShotsFromWords(words, 0, 6000)
    const speakers = new Set(shots.map((s) => s.speaker))
    expect(speakers.has('A')).toBe(true)
    expect(speakers.has('B')).toBe(true)
    expect(shots.every((s) => s.speaker === 'A')).toBe(false)
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

  it('true overlap span ≥1.5 s is detected', () => {
    const words = loadSourceWords([
      { w: 'a', s: 0, e: 3, spk: 0, i: 0 },
      { w: 'b', s: 1, e: 4, spk: 1, i: 1 },
    ])
    const r = overlappingSpeakerRangesFromWords(words, 0, 10_000)
    expect(r.reason).toBe('ok')
    expect(r.ranges.length).toBe(1)
    expect(r.ranges[0]!.endMs - r.ranges[0]!.startMs).toBeGreaterThanOrEqual(1500)
  })

  it('clip_d46c686-style fixture: stricter thresholds yield fewer spans than legacy', () => {
    const words = clipD46c686Words()
    const trimOut = 15_400
    const legacy = legacyOverlapRanges(words, 0, trimOut)
    const next = overlappingSpeakerRangesFromWords(words, 0, trimOut)
    expect(legacy.length).toBeGreaterThan(next.ranges.length)
    expect(next.ranges.every((r) => r.endMs - r.startMs >= 1500)).toBe(true)
    for (const r of next.ranges) {
      expect(r.startMs).toBeGreaterThanOrEqual(0)
      expect(r.endMs).toBeLessThanOrEqual(trimOut)
    }
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
