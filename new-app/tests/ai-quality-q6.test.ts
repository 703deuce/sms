import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { filterAutoBrollSuggestions, brollAssetBlockedByCooldown } from '@/lib/clips/editor/broll-approve-first'
import { filterBeatsForCut } from '@/lib/clips/editor/strong-beats'
import { applySplitScreenOnOverlap, overlappingSpeakerRangesFromWords } from '@/lib/clips/editor/reframe-overlap'
import { patchStudioSoundLane, readStudioSoundLanes } from '@/lib/clips/editor/studio-sound-tracks'
import type { CropShot } from '@/lib/server/clips/clip-detail'
import type { SourceWord } from '@/lib/clips/source-words'

const bounds = { clipStartMs: 0, clipEndMs: 60_000 }

describe('AI_QUALITY Q6 libs', () => {
  it('6.1 studio sound lanes patch music NR with undo-friendly edits', () => {
    const base = normalizeEdits(defaultEdits(bounds), bounds)
    const next = patchStudioSoundLane(base, 'music', { enabled: true, mix: 0.6 })
    const lanes = readStudioSoundLanes(next)
    expect(lanes.music.enabled).toBe(true)
    expect(lanes.music.mix).toBe(0.6)
  })

  it('6.2 overlap words → split layout segments when fallback on', () => {
    const words: SourceWord[] = [
      { s: 0, e: 3, w: 'a', spk: 0, i: 0 },
      { s: 1.5, e: 4.5, w: 'b', spk: 1, i: 1 },
    ]
    const shots: CropShot[] = [
      { startMs: 0, endMs: 2000, speaker: 'A' },
      { startMs: 1500, endMs: 4000, speaker: 'B' },
    ]
    expect(overlappingSpeakerRangesFromWords(words, 0, 60_000).ranges.length).toBeGreaterThan(0)
    const base = normalizeEdits(defaultEdits(bounds), bounds)
    const next = applySplitScreenOnOverlap(base, shots, words, true)
    expect(next.layout.splitScreenFallback).toBe(true)
    expect(next.layout.layoutSegments?.some((s) => s.mode === 'split')).toBe(true)
  })

  it('6.4 strong beats thins grid without samples', () => {
    const beats = [0, 250, 500, 750, 1000, 1250, 1500, 1750]
    const strong = filterBeatsForCut(beats, 'strong')
    expect(strong.length).toBeLessThan(beats.length)
    expect(filterBeatsForCut(beats, 'all')).toEqual(beats)
  })

  it('6.5 blocks same stock asset within 60 s', () => {
    const timeline = [{ id: 'a', source: 'stock' as const, assetId: 'pix_1', startMs: 0, endMs: 3000 }]
    expect(
      brollAssetBlockedByCooldown(timeline, {
        assetId: 'pix_1',
        startMs: 30_000,
        endMs: 33_000,
      }),
    ).toBe(true)
    const { accepted, rejected } = filterAutoBrollSuggestions(timeline, [
      { id: 'b', source: 'stock', assetId: 'pix_1', startMs: 30_000, endMs: 33_000 },
      { id: 'c', source: 'stock', assetId: 'pix_2', startMs: 30_000, endMs: 33_000 },
    ])
    expect(accepted).toHaveLength(1)
    expect(rejected).toHaveLength(1)
  })
})
