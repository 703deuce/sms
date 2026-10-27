import { describe, expect, it } from 'vitest'
import { applyCompositionOp, emptyDocument } from '@/lib/clips/script-edl/ops'

describe('patch_overlays', () => {
  it('replaces overlay list', () => {
    const doc = emptyDocument(['w:0', 'w:1'])
    const next = applyCompositionOp(doc, {
      type: 'patch_overlays',
      overlays: [
        {
          id: 'ovl_1',
          anchorWordId: 'w:0',
          mediaAssetId: 'text:placeholder',
          durMs: 2000,
          layer: 0,
        },
      ],
    })
    expect(next.overlays?.length).toBe(1)
    expect(next.overlays?.[0]?.id).toBe('ovl_1')
  })
})
