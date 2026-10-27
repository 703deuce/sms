import { describe, expect, it } from 'vitest'
import {
  resolveCompositionSourceMediaId,
  sourceMediaIdFromRef,
} from '@/lib/clips/script-editor/media-source'

describe('media-source', () => {
  it('maps take ref to stable source media id', () => {
    expect(sourceMediaIdFromRef({ kind: 'take', takeId: 'tk_abc' })).toBe('take:tk_abc')
  })

  it('prefers composition take over upload', () => {
    const id = resolveCompositionSourceMediaId(
      { id: 'proj_1', uploadId: 'up_1' },
      {
        takeId: 'tk_1',
        primaryTrackId: 'tr_program',
        sourceMediaRef: { kind: 'take', takeId: 'tk_1' },
      },
    )
    expect(id).toBe('take:tk_1')
  })
})
