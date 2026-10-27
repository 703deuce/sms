import { describe, expect, it } from 'vitest'
import {
  musicClipsForTimeline,
  overlayClipsForTimeline,
  sceneMarkersForTimeline,
} from '@/lib/clips/script-editor/timeline-lanes'

describe('timeline-lanes', () => {
  it('returns empty arrays when M7–M10 fields absent', () => {
    const doc = { v: 1 as const, keptWordIds: [], deletedWordIds: [] }
    expect(sceneMarkersForTimeline(doc, [], [])).toEqual([])
    expect(overlayClipsForTimeline(doc)).toEqual([])
    expect(musicClipsForTimeline(doc)).toEqual([])
  })

  it('maps reserved document clips for timeline', () => {
    const doc = {
      v: 1 as const,
      keptWordIds: [],
      deletedWordIds: [],
      scenes: [{ id: 'sc1', outStartMs: 100, label: 'Scene 1' }],
      overlays: [
        { id: 'ov1', anchorWordId: 'w:0', mediaAssetId: 'm1', durMs: 500, outStartMs: 200, layer: 0 },
      ],
      musicTracks: [{ id: 'mu1', assetId: 'a1', outStartMs: 0, durMs: 3000, label: 'Bed' }],
    }
    expect(sceneMarkersForTimeline(doc, [], [])[0].outStartMs).toBe(100)
    expect(overlayClipsForTimeline(doc)[0].outEndMs).toBe(700)
    expect(musicClipsForTimeline(doc)[0].label).toBe('Bed')
  })
})
