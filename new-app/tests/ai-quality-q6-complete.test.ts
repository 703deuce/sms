import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { applyProducerPlanStep } from '@/lib/clips/editor/producer-plan'
import { applyProducerTool } from '@/lib/clips/edits-reducer'
import {
  applySplitScreenOnOverlap,
  overlappingSpeakerRangesFromWords,
  overlappingSpeakerShotIndices,
} from '@/lib/clips/editor/reframe-overlap'
import { patchStudioSoundLane, readStudioSoundLanes, voiceoverStudioFxTrackKeys } from '@/lib/clips/editor/studio-sound-tracks'
import type { CropShot } from '@/lib/server/clips/clip-detail'
import type { SourceWord } from '@/lib/clips/source-words'

const bounds = { clipStartMs: 0, clipEndMs: 60_000 }

describe('Q6-complete batch', () => {
  it('B2 reframe: word overlap → split layoutSegments (not shot-only both-wide)', () => {
    const words: SourceWord[] = [
      { s: 0, e: 3, w: 'hi', spk: 0, i: 0 },
      { s: 1.5, e: 4.5, w: 'yo', spk: 1, i: 1 },
    ]
    const shots: CropShot[] = [
      { startMs: 0, endMs: 2000, speaker: 'A' },
      { startMs: 2000, endMs: 4000, speaker: 'B' },
    ]
    expect(overlappingSpeakerShotIndices(shots)).toEqual([])
    expect(overlappingSpeakerRangesFromWords(words, 0, 60_000).ranges.length).toBeGreaterThan(0)
    const base = normalizeEdits(defaultEdits(bounds), bounds)
    const on = applySplitScreenOnOverlap(base, shots, words, true)
    expect(on.layout.layoutSegments?.some((s) => s.mode === 'split' && s.auto)).toBe(true)
    const off = applySplitScreenOnOverlap(on, shots, words, false)
    expect(off.layout.layoutSegments?.some((s) => s.auto)).toBeFalsy()
  })

  it('1a voiceover NR writes to au track ids (not rejected voiceover key)', () => {
    const base = normalizeEdits(
      {
        ...defaultEdits(bounds),
        tracks: [{ id: 'au2', kind: 'audio', name: 'Voiceover', items: [] }],
        audio: { music: null, sfx: [{ generationId: 'g1', atMs: 0, volume: 1, track: 'au2' }] },
      } as ClipEditsV2,
      bounds,
    )
    expect(voiceoverStudioFxTrackKeys(base)).toEqual(['au2'])
    const next = patchStudioSoundLane(base, 'voiceover', { enabled: true, mix: 0.55 })
    expect(readStudioSoundLanes(next).voiceover.mix).toBe(0.55)
    expect(next.trackFx?.find((f) => f.track === 'au2')?.nr).toBeDefined()
  })

  it('4d producer insert_stock_broll is manual placement', () => {
    const base = normalizeEdits(defaultEdits(bounds), bounds)
    const { edits } = applyProducerTool(base, bounds, {
      name: 'insert_stock_broll',
      args: { assetId: 'pix_1', atMs: 1000, durationMs: 2000 },
    })
    expect(edits.broll?.[0]?.placement).toBe('manual')
  })

  it('5c plan step marked applied only when edits change', () => {
    const base = normalizeEdits(defaultEdits(bounds), bounds)
    const noop = applyProducerPlanStep(base, bounds, [], [{ name: 'set_layout', args: { mode: base.layout.mode } }], 0)
    expect(noop?.applied).toBe(false)
    const ok = applyProducerPlanStep(base, bounds, [], [{ name: 'set_layout', args: { mode: 'fit_blur' } }], 0)
    expect(ok?.applied).toBe(true)
  })
})
