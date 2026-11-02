import { describe, expect, it } from 'vitest'
import { defaultEdits } from '@/lib/clips/edits'
import { layoutForKind } from '@/components/clips/editor/multicam-segment-layout-controls'
import { setLayoutForRange } from '@/lib/clips/editor/multicam-manual'
import { normalizeSourceSegments, type ClipMediaSource } from '@/lib/clips/editor/sources'

/** Prod-like: only angle2 is on edits.sources; library lists main + other uploads too. */
describe('layoutForKind registered partners', () => {
  const angle2: ClipMediaSource = {
    id: 'upl_77bebb',
    ref: 'upload',
    refId: 'ref_angle2',
    mediaType: 'video',
    syncMs: 0,
  }
  const mainUpload: ClipMediaSource = {
    id: 'upl_main',
    ref: 'upload',
    refId: 'ref_main',
    mediaType: 'video',
    syncMs: 0,
  }
  const otherUpload: ClipMediaSource = {
    id: 'upl_other',
    ref: 'upload',
    refId: 'ref_other',
    mediaType: 'video',
    syncMs: 0,
  }
  const library = [mainUpload, angle2, otherUpload]

  it('pip/stack/side_by_side persist with withSourceId main after normalize round-trip', () => {
    const bounds = { clipStartMs: 0, clipEndMs: 60_000, trimMinMs: 0, trimMaxMs: 60_000 }
    const base = {
      ...defaultEdits(bounds),
      trim: { in: 0, out: 32_000 },
      sources: [angle2],
      sourceSegments: [{ id: 'mc-10044', sourceId: angle2.id, startMs: 10_044, endMs: 32_000 }],
    }
    for (const kind of ['pip', 'stack', 'side_by_side'] as const) {
      const layout = layoutForKind(kind, angle2.id, base, library)
      expect(layout?.withSourceId).toBe('main')
      const next = setLayoutForRange(base, 12_000, 32_000, layout!, library)
      const seg = normalizeSourceSegments(next.sourceSegments, next.sources)?.[0]
      expect(seg?.layout?.kind).toBe(kind)
      expect(seg?.layout?.withSourceId).toBe('main')
    }
  })
})
