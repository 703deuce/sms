import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { MAX_ANGLES, multicamAngles, setAngleForRange } from '@/lib/clips/editor/multicam-manual'
import { fillActiveSpeakerGaps, segmentAudio, type ClipMediaSource } from '@/lib/clips/editor/sources'
import { editorEditsReducer } from '@/components/clips/editor/use-editor-state'

const bounds = { clipStartMs: 0, clipEndMs: 20000, trimMinMs: 0, trimMaxMs: 40000 }
const base = (patch: Partial<ClipEditsV2> = {}): ClipEditsV2 => ({ ...normalizeEdits(defaultEdits(bounds), bounds), ...patch })

describe('MC batch 3', () => {
  it('MC-09: up to 18 angles including image and audio uploads', () => {
    const sources: ClipMediaSource[] = Array.from({ length: 12 }, (_, i) => ({
      id: `u${i}`,
      ref: 'upload',
      refId: `u${i}`,
      mediaType: i % 3 === 0 ? 'image' : i % 3 === 1 ? 'audio' : 'video',
      label: `A${i}`,
      syncMs: i % 3 === 2 ? 0 : undefined,
    }))
    const e = base({ sources })
    const angles = multicamAngles(e, [])
    expect(angles.length).toBeLessThanOrEqual(MAX_ANGLES)
    expect(angles.length).toBe(13)
    expect(angles.some((a) => a.sourceId === 'u1')).toBe(true)
  })

  it('MC-09: manual image/audio angle segments', () => {
    const img: ClipMediaSource = { id: 'logo', ref: 'upload', refId: 'logo', mediaType: 'image', label: 'Logo' }
    const aud: ClipMediaSource = { id: 'vo', ref: 'upload', refId: 'vo', mediaType: 'audio', label: 'VO' }
    let e = setAngleForRange(base({ sources: [img, aud] }), 1000, 4000, 'logo', [])
    e = setAngleForRange(e, 5000, 8000, 'vo', [])
    expect(e.sourceSegments?.map((s) => s.sourceId)).toEqual(['logo', 'vo'])
    expect(segmentAudio(e.sourceSegments![1]!, aud)).toBe('source')
  })

  it('MC-08: fillActiveSpeakerGaps keeps manual segment', () => {
    const cam: ClipMediaSource = { id: 'u2', ref: 'upload', refId: 'u2', mediaType: 'video', label: 'B', syncMs: 0 }
    const e = base({
      sources: [cam],
      multicam: { speakerSources: { '0': 'u2' }, minHoldMs: 500, wideEveryMs: 120_000 },
      sourceSegments: [{ id: 'manual', sourceId: 'u2', startMs: 8000, endMs: 12000 }],
    })
    const words = [
      { s: 0, e: 2, spk: 0, i: 0 },
      { s: 2, e: 5, spk: 0, i: 1 },
      { s: 9, e: 11, spk: 0, i: 2 },
    ]
    const { edits: next, generated } = fillActiveSpeakerGaps(e, words, 0, 20000)
    expect(next.sourceSegments?.find((s) => s.id === 'manual')).toBeTruthy()
    expect(generated.every((g) => g.auto)).toBe(true)
    for (const g of next.sourceSegments?.filter((s) => s.auto) ?? []) {
      expect(g.endMs <= 8000 || g.startMs >= 12000).toBe(true)
    }
  })

  it('MC-08: auto camera cuts is one named undo step', () => {
    const cam: ClipMediaSource = { id: 'u2', ref: 'upload', refId: 'u2', mediaType: 'video', label: 'B', syncMs: 0 }
    const e = base({
      sources: [cam],
      multicam: { speakerSources: { '0': 'u2' }, minHoldMs: 500, wideEveryMs: 120_000 },
    })
    const words = [
      { s: 0, e: 2, spk: 0, i: 0 },
      { s: 2, e: 5, spk: 0, i: 1 },
      { s: 6, e: 9, spk: 0, i: 2 },
    ]
    const { edits: next } = fillActiveSpeakerGaps(e, words, 0, 20000)
    const initial = {
      edits: e,
      past: [] as ClipEditsV2[],
      pastLabels: [] as (string | undefined)[],
      future: [] as ClipEditsV2[],
      saveState: 'saved' as const,
      producerStrip: null,
    }
    const after = editorEditsReducer(initial, { type: 'pass', edits: next, label: 'Auto camera cuts' })
    expect(after.pastLabels).toEqual(['Auto camera cuts'])
    expect(after.past).toHaveLength(1)
  })
})
