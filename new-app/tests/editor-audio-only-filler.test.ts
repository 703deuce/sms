import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits, outputDurationMs, editsPayloadForSave } from '@/lib/clips/edits'
import { addAudioMuteRanges, removeAudioMuteRanges, audioMuteGain, audioMuteAllowed } from '@/lib/clips/editor/audio-only-filler'

const bounds = { clipStartMs: 1000, clipEndMs: 5000 }
const original = () => defaultEdits(bounds)

describe('Audio-only filler editing', () => {
  it('mutes original source time without changing video duration, cuts or captions', () => {
    const e = original()
    const next = addAudioMuteRanges(e, [[2100, 2350]])
    expect(next.audioMuteRanges).toEqual([[2100, 2350]])
    expect(next.cutRanges).toEqual(e.cutRanges)
    expect(outputDurationMs(next)).toBe(outputDurationMs(e))
    expect(next.captions).toEqual(e.captions)
    const saved = editsPayloadForSave(next)
    const loaded = normalizeEdits(saved, bounds)
    expect(loaded.audioMuteRanges).toEqual([[2100, 2350]])
    expect(removeAudioMuteRanges(loaded, [[2100, 2350]]).audioMuteRanges).toEqual([])
  })

  it('has a small fade, full silence in middle and unity volume outside the filler', () => {
    const ranges: [number, number][] = [[2100, 2350]]
    expect(audioMuteGain(2099, ranges)).toBe(1)
    expect(audioMuteGain(2106, ranges)).toBeCloseTo(0.5)
    expect(audioMuteGain(2200, ranges)).toBe(0)
    expect(audioMuteGain(2344, ranges)).toBeCloseTo(0.5)
    expect(audioMuteGain(2350, ranges)).toBe(1)
  })

  it('does not silently allow invalid timing for speed-warped or replaced media', () => {
    const edits = original()
    expect(audioMuteAllowed(edits)).toBe(true)
    expect(audioMuteAllowed({ ...edits, speed: 1.5 })).toBe(false)
    expect(audioMuteAllowed({ ...edits, sourceSegments: [{ sourceId: 'other', startMs: 1000, endMs: 4000 }] } as never)).toBe(false)
  })

  it('merges adjacent mutes and clips them to the source trim', () => {
    const edits = addAudioMuteRanges(original(), [[800, 1500], [1495, 2000], [4800, 5300]])
    expect(edits.audioMuteRanges).toEqual([[1000, 2000], [4800, 5000]])
  })
})
